"""
상품 풀 자동 갱신 스케줄러

1시간마다 전체 상품에서 랜덤 5000개를 추출하여 Redis에 저장
"""
import logging
from typing import Optional
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from motor.motor_asyncio import AsyncIOMotorDatabase

from .product_random_router import update_product_pool

logger = logging.getLogger(__name__)

# 스케줄러 인스턴스 (싱글톤 패턴)
_scheduler: Optional[AsyncIOScheduler] = None


def get_scheduler() -> AsyncIOScheduler:
    """
    스케줄러 인스턴스를 반환 (싱글톤 패턴)
    
    Returns:
        AsyncIOScheduler 인스턴스
    """
    global _scheduler
    if _scheduler is None:
        _scheduler = AsyncIOScheduler()
    return _scheduler


async def refresh_product_pool_job(db: AsyncIOMotorDatabase):
    """
    상품 풀 갱신 작업 (1시간마다 실행)
    
    Args:
        db: MongoDB 데이터베이스 인스턴스
    """
    try:
        logger.info("[Scheduler] 상품 풀 갱신 시작")
        product_ids = await update_product_pool(db)
        logger.info(f"[Scheduler] 상품 풀 갱신 완료: {len(product_ids)}개 상품")
    except Exception as e:
        logger.error(f"[Scheduler] 상품 풀 갱신 실패: {e}", exc_info=True)


def start_scheduler(db: AsyncIOMotorDatabase):
    """
    스케줄러 시작
    
    Args:
        db: MongoDB 데이터베이스 인스턴스
    """
    scheduler = get_scheduler()

    # 중복 시작 방지
    if scheduler.running:
        logger.warning("[Scheduler] 이미 실행 중")
        return

    # 1시간마다 실행하는 작업 등록
    scheduler.add_job(
        refresh_product_pool_job,
        trigger=IntervalTrigger(hours=1),
        args=[db],
        id='refresh_product_pool',
        name='상품 풀 자동 갱신',
        replace_existing=True,  # 기존 작업이 있으면 교체
        max_instances=1  # 동시 실행 방지
    )

    scheduler.start()
    logger.info("[Scheduler] 스케줄러 시작 완료 (1시간 간격)")


def stop_scheduler():
    """
    스케줄러 중지
    """
    scheduler = get_scheduler()

    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("[Scheduler] 스케줄러 중지 완료")
    else:
        logger.debug("[Scheduler] 스케줄러가 실행 중이 아님")