from typing import Any, Dict

from sqlalchemy import MetaData
from sqlalchemy.orm import as_declarative

MYSQL_INDEXES_NAMING_CONVENTION = {
    "ix": "idx_%(table_name)s_%(column_0_name)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s",
    "pk": "pk_%(table_name)s",
}


metadata = MetaData(naming_convention=MYSQL_INDEXES_NAMING_CONVENTION)


class_registry: Dict[str, Any] = {}


@as_declarative(class_registry=class_registry)
class Base:
    id: Any
    __name__: str
    __abstract__: bool = True
    metadata = metadata