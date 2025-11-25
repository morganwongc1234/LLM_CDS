# backend/rag/search_faiss.py
import argparse
import json
import faiss
import numpy as np

parser = argparse.ArgumentParser()
parser.add_argument("--query", required=True)
parser.add_argument("--k", type=int, default=5)
parser.add_argument("--index", required=True)
parser.add_argument("--meta", required=True)
args = parser.parse_args()

# Load FAISS index
index = faiss.read_index(args.index)

# Load metadata
meta = []
with open(args.meta, "r", encoding="utf8") as f:
    for line in f:
        try:
            meta.append(json.loads(line))
        except:
            pass

if not meta:
    print(json.dumps({"error": "Empty metadata"}))
    exit(1)

# For now, embed query using mean-pooling of chars (temporary fallback)
# You should replace this with OpenAI embeddings if needed.
def cheap_embed(q):
    arr = np.frombuffer(q.encode("utf8"), dtype=np.uint8).astype("float32")
    if len(arr) == 0:
        arr = np.zeros(256, dtype="float32")
    # pad or truncate to match dim
    dim = index.d
    if len(arr) > dim:
        arr = arr[:dim]
    elif len(arr) < dim:
        arr = np.pad(arr, (0, dim - len(arr)))
    return arr.reshape(1, dim)

vec = cheap_embed(args.query)

# Perform search
distances, indices = index.search(vec, args.k)

# Collect results
results = []
for i, idx in enumerate(indices[0]):
    if idx == -1 or idx >= len(meta):
        continue
    item = meta[idx]
    item["distance"] = float(distances[0][i])
    results.append(item)

print(json.dumps(results, ensure_ascii=False))