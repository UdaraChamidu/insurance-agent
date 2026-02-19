from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from app.api import deps
from app.models import Document, Lead
from app.core.supabase import supabase
import uuid
import os

router = APIRouter()

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
        if not supabase:
            raise HTTPException(status_code=500, detail="Supabase client not initialized")

        # Create unique path: public/lead_id/uuid-filename
        # Or private bucket 'client-docs'
        bucket_name = "client-docs"
        file_ext = os.path.splitext(file.filename)[1]
        unique_name = f"{uuid.uuid4()}{file_ext}"
        file_path = f"{lead_id}/{unique_name}"
        
        # Upload
        res = supabase.storage.from_(bucket_name).upload(
            path=file_path,
            file=content,
            file_options={"content-type": file.content_type}
        )
        
        # If upload fails, res usually contains error or data. 
        # supabase-py can throw exceptions too.
        
    except Exception as e:
        print(f"Supabase Upload Error: {e}")
        raise HTTPException(status_code=500, detail=f"File upload failed: {str(e)}")

    # 3. Save to Database
    new_doc = Document(
        leadId=lead_id,
        filename=file.filename,
        filePath=file_path,
        fileType=file.content_type,
        fileSize=len(content),
        description=description
    )
    db.add(new_doc)
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
