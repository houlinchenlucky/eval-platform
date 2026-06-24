"""FastAPI 应用入口。"""
from __future__ import annotations

import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.database import init_db
from app.routers import compare, reports, templates

app = FastAPI(title="评测报告可视化与回溯平台")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content={"detail": f"服务器内部错误: {type(exc).__name__}: {exc}"},
    )


@app.on_event("startup")
def on_startup() -> None:
    init_db()


app.include_router(templates.router)
app.include_router(reports.router)
app.include_router(compare.router)

# 托管前端静态文件（生产模式）
_DIST_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "frontend",
    "dist",
)

if os.path.isdir(_DIST_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(_DIST_DIR, "assets")), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(request: Request, full_path: str) -> FileResponse:
        if full_path.startswith("api/") or full_path == "api":
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Not Found")
        index = os.path.join(_DIST_DIR, "index.html")
        return FileResponse(index)
