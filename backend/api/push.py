from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
import json

from database import get_db
from models import User, PushSubscription
from auth import get_current_user

VAPID_PRIVATE_KEY = "C5YNjkV-BFlmT17UU4ST-dTLyUq6PqCdyxD0oEIWUT8"
VAPID_CLAIMS = {"sub": "mailto:it@eag-south.ru"}

router = APIRouter()


class PushSubscriptionCreate(BaseModel):
    endpoint: str
    keys: dict


@router.post("/subscribe")
def subscribe(
        data: PushSubscriptionCreate,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    subscription = db.query(PushSubscription).filter_by(user_id=current_user.id).first()
    if subscription:
        subscription.endpoint = data.endpoint
        subscription.keys = json.dumps(data.keys)
    else:
        subscription = PushSubscription(
            user_id=current_user.id,
            endpoint=data.endpoint,
            keys=json.dumps(data.keys)
        )
        db.add(subscription)
    db.commit()
    return {"status": "success"}
