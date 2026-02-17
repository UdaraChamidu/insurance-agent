from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def get_documents():
    return {"message": "Documents endpoint placeholder"}
