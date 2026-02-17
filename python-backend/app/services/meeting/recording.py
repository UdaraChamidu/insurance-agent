class RecordingService:
    def __init__(self):
        pass

    async def start_recording(self, meeting_id: str):
        print(f"Starting recording for {meeting_id}")
        return True

    async def stop_recording(self, meeting_id: str):
        print(f"Stopping recording for {meeting_id}")
        return True

recording_service = RecordingService()
