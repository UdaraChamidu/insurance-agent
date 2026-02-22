from app.core.config import settings
import google.generativeai as genai
from app.core.database import SessionLocal
from app.models import Session as DbSession, Transcript
from app.services.llm.usage_tracker import gemini_usage_tracker
import json

# Configure Gemini
if settings.GEMINI_API_KEY:
    genai.configure(api_key=settings.GEMINI_API_KEY)

class SummaryService:
    def __init__(self):
        self.model_name = "gemini-2.5-flash"

    async def generate_call_summary(self, session_id: str):
        db = SessionLocal()
        try:
            # 1. Fetch Transcripts
            transcripts = db.query(Transcript).filter(Transcript.sessionId == session_id).order_by(Transcript.timestamp).all()
            
            if not transcripts:
                print(f"No transcripts found for session {session_id}")
                return None

            # 2. Format Transcript for AI
            full_text = ""
            for t in transcripts:
                role = "Agent" if t.role == "agent" else "Customer" if t.role == "customer" else "AI"
                full_text += f"{role}: {t.content}\n"

            # 3. Prompt Gemini
            prompt = f"""
            You are an expert insurance compliance auditor and summarizer.
            Analyze the following sales call transcript between an Agent and a Customer.

            Transcript:
            {full_text}

            Generate a valid JSON object with the following fields:
            - "callSummary": A concise 2-3 sentence summary of the call.
            - "actionItems": A list of specific follow-up actions for the agent.
            - "complianceFlags": An object checking these compliance rules:
                - "disclaimerRead": boolean (did agent read the mandatory disclaimer?)
                - "forbiddenTopics": boolean (did agent mention forbidden topics like specific drug coverage guarantees?)
                - "notes": string (short explanation of compliance finding)
            - "sentiment": "positive", "neutral", or "negative"

            Return ONLY valid JSON.
            """

            model = genai.GenerativeModel(self.model_name)
            response = await model.generate_content_async(prompt)
            gemini_usage_tracker.record_response(
                operation="call_summary",
                response_payload=response,
                request_text=prompt,
            )
            
            try:
                # Clean code fences if present
                clean_text = response.text.replace("```json", "").replace("```", "").strip()
                result = json.loads(clean_text)
                
                # 4. Update Session in DB
                session = db.query(DbSession).filter(DbSession.id == session_id).first()
                if session:
                    session.callSummary = result.get("callSummary")
                    session.actionItems = result.get("actionItems")
                    session.complianceFlags = result.get("complianceFlags")
                    # We could also save sentiment if we had a column
                    
                    db.commit()
                    print(f"✅ Generated summary for session {session_id}")
                    return result
                
            except json.JSONDecodeError:
                print(f"Failed to parse AI summary JSON: {response.text}")
                return None

        except Exception as e:
            gemini_usage_tracker.record_error("call_summary", e)
            print(f"Error generating call summary: {e}")
            return None
        finally:
            db.close()

summary_service = SummaryService()
