import pandas as pd
from sentence_transformers import SentenceTransformer
import faiss

df = pd.read_excel("dataset/vietnam_food_dataset_3000.xlsx")

texts = df["food_name"].tolist()

model = SentenceTransformer("all-MiniLM-L6-v2")

embeddings = model.encode(texts)

dimension = embeddings.shape[1]

index = faiss.IndexFlatL2(dimension)

index.add(embeddings)

faiss.write_index(index, "vector_db/food.index")