from fastapi import APIRouter

router = APIRouter()

@router.get("/")
def test():
    return {"message": "Hello test route"}

