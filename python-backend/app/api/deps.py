from typing import Generator
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from supabase import Client
from app.core.supabase import supabase

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def get_db() -> Generator:
    try:
        yield supabase
    finally:
        pass

async def get_current_user(token: str = Depends(oauth2_scheme)):
    # This is a placeholder for actual Supabase Auth verification
    # logic using the token
    user = supabase.auth.get_user(token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user
