from typing import Any, List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.orm import Session
from app.api import deps
from app.models import Document, Lead, PipelineHistory
from app.core.supabase import supabase
import uuid
import os

router = APIRouter()

ALLOWED_CENSUS_EXTENSIONS = {".csv", ".xlsx", ".xls", ".pdf"}
GROUP_STAGES_BEFORE_CENSUS_RECEIVED = {
    "new_lead",
    "contacted",
    "discovery_scheduled",
    "census_requested",
}


def _build_document_description(base_label: str, description: Optional[str]) -> str:
    extra = (description or "").strip()
    if not extra:
        return base_label
    return f"{base_label} - {extra}"


def _store_document(
    *,
    db: Session,
    lead_id: str,
    filename: str,
    content: bytes,
    content_type: Optional[str],
    description: Optional[str],
    path_prefix: Optional[str] = None,
) -> Document:
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase client not initialized")

    file_ext = os.path.splitext(filename or "")[1]
    unique_name = f"{uuid.uuid4()}{file_ext}"
    storage_parts = [lead_id]
    if path_prefix:
        storage_parts.append(path_prefix.strip("/"))
    storage_parts.append(unique_name)
    file_path = "/".join(storage_parts)
    normalized_content_type = (content_type or "application/octet-stream").strip()

    upload_result = supabase.storage.from_("client-docs").upload(
        path=file_path,
        file=content,
        file_options={
            "content-type": normalized_content_type,
            "upsert": False,
        },
    )

    if isinstance(upload_result, dict):
        error_payload = upload_result.get("error")
        if error_payload:
            raise RuntimeError(str(error_payload))

    new_doc = Document(
        leadId=lead_id,
        filename=filename,
        filePath=file_path,
        fileType=normalized_content_type,
        fileSize=len(content),
        description=description,
    )
    db.add(new_doc)
    db.flush()
    return new_doc

@router.get("/test")
def test_endpoint():
    return {"status": "ok", "message": "Client Docs router is working"}

@router.post("/upload", response_model=Any)
@router.post("/upload-file", response_model=Any)
async def upload_document(
    file: UploadFile = File(...),
    lead_id: str = Form(...),
    description: str = Form(None),
    db: Session = Depends(deps.get_db)
):
    """
    Upload a document for a specific lead to Supabase Storage.
    """
    print(f"DEBUG: Received upload request for lead {lead_id}, file {file.filename}", flush=True)
    # 1. Verify Lead exists
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        print("DEBUG: Lead not found", flush=True)
        raise HTTPException(status_code=404, detail="Lead not found")

    # Read file content early to get size for debug print
    content = await file.read()
    print(f"DEBUG: File read, size {len(content)} bytes. Uploading to Supabase...", flush=True)

    # 2. Upload to Supabase
    try:
        new_doc = _store_document(
            db=db,
            lead_id=lead_id,
            filename=file.filename,
            content=content,
            content_type=file.content_type,
            description=description,
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Supabase Upload Error: {e}")
        raise HTTPException(status_code=500, detail=f"File upload failed: {str(e)}")

    # 3. Save to Database
    db.commit()
    db.refresh(new_doc)

    return {
        "success": True,
        "document": {
            "id": new_doc.id,
            "filename": new_doc.filename,
            "url": file_path # This is the internal path
        }
    }


@router.post("/upload-census", response_model=Any)
async def upload_census_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    lead_id: str = Form(...),
    description: str = Form(None),
    db: Session = Depends(deps.get_db),
):
    """
    Upload an employer census file, store it under a census-specific path,
    and advance the group lead pipeline to census_received when appropriate.
    """
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    if (lead.leadType or "").lower() != "group":
        raise HTTPException(status_code=400, detail="Census uploads are only available for employer/group leads")

    file_ext = os.path.splitext(file.filename or "")[1].lower()
    if file_ext not in ALLOWED_CENSUS_EXTENSIONS:
        allowed = ", ".join(sorted(ALLOWED_CENSUS_EXTENSIONS))
        raise HTTPException(status_code=400, detail=f"Unsupported census file type. Allowed: {allowed}")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    try:
        new_doc = _store_document(
            db=db,
            lead_id=lead_id,
            filename=file.filename,
            content=content,
            content_type=file.content_type,
            description=_build_document_description("Employer census upload", description),
            path_prefix="census",
        )

        pipeline_updated = False
        previous_status = lead.pipelineStatus or "new_lead"
        if previous_status in GROUP_STAGES_BEFORE_CENSUS_RECEIVED:
            lead.pipelineStatus = "census_received"
            db.add(
                PipelineHistory(
                    id=str(uuid.uuid4()),
                    leadId=lead_id,
                    fromStage=previous_status,
                    toStage="census_received",
                    notes="Census uploaded via employer census portal",
                )
            )
            pipeline_updated = True

        db.commit()
        db.refresh(new_doc)
        db.refresh(lead)

        from app.services.notification_service import notification_service

        company_label = lead.companyName or lead.contactPerson or lead.email or lead_id
        background_tasks.add_task(
            notification_service.create_notification,
            type="file",
            title="Employer Census Uploaded",
            message=f"{company_label} uploaded {file.filename}",
            metadata={
                "leadId": lead_id,
                "documentId": new_doc.id,
                "documentKind": "census",
                "pipelineStatus": lead.pipelineStatus,
            },
        )

        return {
            "success": True,
            "document": {
                "id": new_doc.id,
                "filename": new_doc.filename,
                "url": new_doc.filePath,
                "uploadedAt": new_doc.createdAt.isoformat() if new_doc.createdAt else datetime.utcnow().isoformat(),
            },
            "lead": {
                "id": lead.id,
                "pipelineStatus": lead.pipelineStatus,
                "pipelineUpdated": pipeline_updated,
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Census upload error: {e}")
        raise HTTPException(status_code=500, detail=f"Census upload failed: {str(e)}")

@router.get("/lead/{lead_id}", response_model=Any)
def get_lead_documents(
    lead_id: str,
    db: Session = Depends(deps.get_db)
):
    """
    Get all documents for a lead
    """
    docs = db.query(Document).filter(Document.leadId == lead_id).order_by(Document.createdAt.desc()).all()
    return {
        "success": True,
        "documents": docs
    }

@router.get("/download/{doc_id}")
def download_document(
    doc_id: str,
    db: Session = Depends(deps.get_db)
):
    """
    Generate a signed URL for verifying and downloading a private file
    """
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase client not initialized")
        
    try:
        # Create signed URL valid for 60 seconds
        res = supabase.storage.from_("client-docs").create_signed_url(doc.filePath, 60)
        
        # Depending on supabase-py version, res might be a dict or object
        # Usually it returns {'signedURL': '...'} or proper object
        # With latest supabase-py:
        if isinstance(res, dict) and "signedURL" in res:
             return {"url": res["signedURL"]}
        elif hasattr(res, 'signedURL'): # Try attribute access just in case
             return {"url": res.signedURL}
        elif isinstance(res, str): # direct url?
             return {"url": res}
        else:
             # Fallback: inspect what we got
             return {"url": res.get("signedURL") or res}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate download link: {str(e)}")
