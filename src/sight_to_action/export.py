"""Export a PathwayResult to the small JSON the web app consumes."""
import json
from pathlib import Path

from .pathway import PathwayResult

PROCESSED_DIR = Path(__file__).resolve().parents[2] / "data" / "processed"


def to_json(result: PathwayResult, name: str, meta: dict) -> Path:
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        "meta": meta,
        "nodes": [
            {k: (None if v != v else v) for k, v in row.items()}  # NaN -> None
            for row in result.node_table.to_dict(orient="records")
        ],
        "edges": result.edge_table.rename(
            columns={"type_pre": "source", "type_post": "target"}
        ).to_dict(orient="records"),
    }
    out_path = PROCESSED_DIR / f"{name}.json"
    out_path.write_text(json.dumps(payload, indent=2))
    return out_path
