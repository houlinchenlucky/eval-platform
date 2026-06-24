"""数据库连接与会话管理（SQLite + SQLAlchemy 2.0）。"""
from __future__ import annotations

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

# 数据库文件放在 backend/ 目录下
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "eval_platform.db")
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False, "timeout": 10},
    pool_pre_ping=True,
    echo=False,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    """所有 ORM 模型的基类。"""


def get_db():
    """FastAPI 依赖：每个请求一个会话，结束后关闭。"""
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def init_db() -> None:
    """启动时自动建表。"""
    from app import models  # noqa: F401  确保模型被注册

    Base.metadata.create_all(bind=engine)
