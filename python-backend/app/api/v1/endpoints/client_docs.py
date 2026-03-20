from typing import Any, List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.orm import Session
from app.api import deps
from app.models import Document, Lead, PipelineHistory
from app.core.database import get_db as get_sql_db
from app.core.supabase import supabase
import uuid
import os
import secrets

router = APIRouter()

ALLOWED_CENSUS_EXTENSIONS = {".csv", ".xlsx", ".xls", ".pdf"}
ALLOWED_UPLOAD_EXTENSIONS = {".csv", ".xlsx", ".xls", ".pdf", ".doc", ".docx", ".png", ".jpg", ".jpeg", ".gif", ".tiff"}
MAX_UPLOAD_SIZE = 25 * 1024 * 1024  # 25 MB

DOCUMENT_FOLDERS = [
    "Prospecting",
    "Active Quotes",
    "Sold Groups",
    "Renewals",
    "Compliance-Docs",
]

STAGE_TO_FOLDER = {
    "new_lead": "Prospecting",
    "contacted": "Prospecting",
    "discovery_scheduled": "Prospecting",
    "census_requested": "Active Quotes",
    "census_received": "Active Quotes",
    "sent_to_warner": "Active Quotes",
    "quotes_received": "Active Quotes",
    "proposal_presented": "Active Quotes",
    "closed_won": "Sold Groups",
    "closed_lost": "Prospecting",
    "renewal_followup": "Renewals",
}
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


# ---------------------------------------------------------------------------
# Secure File Collection Portal (token-based public upload)
# ---------------------------------------------------------------------------

@router.get("/portal/{token}")
def get_portal_info(token: str, db: Session = Depends(deps.get_db)):
    """
    Public endpoint: validate an upload token and return lead info
    so the upload page can show the company name.
    """
    sql_db = next(get_sql_db())
    try:
        lead = sql_db.query(Lead).filter(Lead.uploadToken == token).first()
        if not lead:
            raise HTTPException(status_code=404, detail="Invalid or expired upload link")
        return {
            "success": True,
            "lead": {
                "id": lead.id,
                "companyName": lead.companyName or "",
                "contactPerson": lead.contactPerson or f"{lead.firstName or ''} {lead.lastName or ''}".strip(),
            },
        }
    finally:
        sql_db.close()


@router.post("/portal/{token}/upload")
async def portal_upload(
    token: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    description: str = Form(None),
    folder: str = Form(None),
    db: Session = Depends(deps.get_db),
):
    """
    Public endpoint: upload a document using a secure token.
    Validates file type/size and stores under the lead's folder.
    """
    sql_db = next(get_sql_db())
    try:
        lead = sql_db.query(Lead).filter(Lead.uploadToken == token).first()
        if not lead:
            raise HTTPException(status_code=404, detail="Invalid or expired upload link")

        file_ext = os.path.splitext(file.filename or "")[1].lower()
        if file_ext not in ALLOWED_UPLOAD_EXTENSIONS:
            allowed = ", ".join(sorted(ALLOWED_UPLOAD_EXTENSIONS))
            raise HTTPException(status_code=400, detail=f"File type not allowed. Accepted: {allowed}")

        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Uploaded file is empty")
        if len(content) > MAX_UPLOAD_SIZE:
            raise HTTPException(status_code=400, detail=f"File too large. Maximum size is {MAX_UPLOAD_SIZE // (1024*1024)} MB")

        folder_category = folder if folder in DOCUMENT_FOLDERS else STAGE_TO_FOLDER.get(lead.pipelineStatus, "Prospecting")
        path_prefix = folder_category.lower().replace(" ", "-")

        new_doc = _store_document(
            db=sql_db,
            lead_id=lead.id,
            filename=file.filename,
            content=content,
            content_type=file.content_type,
            description=_build_document_description("Portal upload", description),
            path_prefix=path_prefix,
        )
        new_doc.folderCategory = folder_category

        sql_db.commit()
        sql_db.refresh(new_doc)

        from app.services.notification_service import notification_service
        company_label = lead.companyName or lead.contactPerson or lead.email or lead.id
        background_tasks.add_task(
            notification_service.create_notification,
            type="file",
            title="Document Uploaded via Portal",
            message=f"{company_label} uploaded {file.filename}",
            metadata={
                "leadId": lead.id,
                "documentId": new_doc.id,
                "folder": folder_category,
                "source": "secure_portal",
            },
        )

        return {
            "success": True,
            "document": {
                "id": new_doc.id,
                "filename": new_doc.filename,
                "folder": folder_category,
                "uploadedAt": new_doc.createdAt.isoformat() if new_doc.createdAt else None,
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        sql_db.rollback()
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")
    finally:
        sql_db.close()


# ---------------------------------------------------------------------------
# Upload token generation (admin)
# ---------------------------------------------------------------------------

@router.post("/generate-token/{lead_id}")
def generate_upload_token(lead_id: str, db: Session = Depends(deps.get_db)):
    """Admin endpoint: generate a unique upload token for a lead."""
    sql_db = next(get_sql_db())
    try:
        lead = sql_db.query(Lead).filter(Lead.id == lead_id).first()
        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found")

        if not lead.uploadToken:
            lead.uploadToken = secrets.token_urlsafe(32)
            sql_db.commit()
            sql_db.refresh(lead)

        return {
            "success": True,
            "uploadToken": lead.uploadToken,
            "uploadUrl": f"/upload/{lead.uploadToken}",
        }
    finally:
        sql_db.close()


# ---------------------------------------------------------------------------
# Document folder management
# ---------------------------------------------------------------------------

@router.get("/folders")
def list_folder_categories():
    """Return the available document folder categories."""
    return {"success": True, "folders": DOCUMENT_FOLDERS}


@router.get("/folders/{lead_id}")
def get_lead_folders(lead_id: str, db: Session = Depends(deps.get_db)):
    """Get documents grouped by folder for a lead."""
    sql_db = next(get_sql_db())
    try:
        docs = (
            sql_db.query(Document)
            .filter(Document.leadId == lead_id)
            .order_by(Document.createdAt.desc())
            .all()
        )

        folders = {f: [] for f in DOCUMENT_FOLDERS}
        folders["Uncategorized"] = []

        for doc in docs:
            cat = doc.folderCategory if doc.folderCategory in DOCUMENT_FOLDERS else "Uncategorized"
            folders[cat].append({
                "id": doc.id,
                "filename": doc.filename,
                "fileType": doc.fileType,
                "fileSize": doc.fileSize,
                "description": doc.description,
                "folderCategory": doc.folderCategory,
                "createdAt": doc.createdAt.isoformat() if doc.createdAt else None,
            })

        return {"success": True, "folders": folders}
    finally:
        sql_db.close()


@router.patch("/move/{doc_id}")
def move_document_folder(doc_id: str, folder: str = Form(...), db: Session = Depends(deps.get_db)):
    """Move a document to a different folder category."""
    if folder not in DOCUMENT_FOLDERS:
        raise HTTPException(status_code=400, detail=f"Invalid folder. Options: {', '.join(DOCUMENT_FOLDERS)}")

    sql_db = next(get_sql_db())
    try:
        doc = sql_db.query(Document).filter(Document.id == doc_id).first()
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")

        doc.folderCategory = folder
        sql_db.commit()
        return {"success": True, "documentId": doc_id, "folder": folder}
    finally:
        sql_db.close()
