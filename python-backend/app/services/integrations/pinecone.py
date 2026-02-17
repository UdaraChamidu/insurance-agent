from pinecone import Pinecone, ServerlessSpec
from app.core.config import settings

class PineconeService:
    def __init__(self):
        self.api_key = settings.PINECONE_API_KEY
        self.index_name = settings.PINECONE_INDEX_NAME
        
        if not self.api_key:
            print("Warning: Pinecone API key not configured")
            self.pc = None
            self.index = None
            return

        self.pc = Pinecone(api_key=self.api_key)
        self.index = self.pc.Index(self.index_name)
        
        # Namespaces for regulatory universes
        self.namespaces = {
            "TRAINING": 'training-reference',
            "FL_STATE": 'fl-state-authority',
            "CMS_MEDICARE": 'cms-medicare',
            "FEDERAL_ACA": 'federal-aca',
            "ERISA": 'erisa-irs-selffunded',
            "FL_MEDICAID": 'fl-medicaid-agency',
            "CARRIER_FMO": 'carrier-fmo-policies'
        }

    def upsert(self, vectors, namespace):
        if not self.index:
            return False
        try:
            self.index.upsert(vectors=vectors, namespace=namespace)
            return True
        except Exception as e:
            print(f"Pinecone upsert error: {e}")
            return False

    def query(self, vector, namespace, top_k=10, filter=None):
        if not self.index:
            return []
        try:
            res = self.index.query(
                vector=vector,
                namespace=namespace,
                top_k=top_k,
                filter=filter,
                include_metadata=True
            )
            return res.matches
        except Exception as e:
            print(f"Pinecone query error: {e}")
            return []

pinecone_service = PineconeService()
