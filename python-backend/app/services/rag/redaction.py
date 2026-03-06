import re


class RedactionService:
    def __init__(self):
        self.patterns = [
            (re.compile(r"\b[\w.\-]+@[\w.\-]+\.[A-Za-z]{2,}\b"), "[EMAIL]"),
            (re.compile(r"\b(?:\+?1[\s\-.]?)?(?:\(?\d{3}\)?[\s\-.]?)\d{3}[\s\-.]?\d{4}\b"), "[PHONE]"),
            (re.compile(r"\b\d{3}-\d{2}-\d{4}\b"), "[SSN]"),
            (re.compile(r"\b(?:ssn|social security|member id|member number|policy id|id number)\s*[:#]?\s*[A-Za-z0-9\-]{4,}\b", re.IGNORECASE), "[ID]"),
            (re.compile(r"\b(?:dob|date of birth|birth date)\s*[:#]?\s*(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})\b", re.IGNORECASE), "[DOB]"),
            (re.compile(r"\b\d{1,6}\s+[A-Za-z0-9.\- ]+\s+(?:st|street|rd|road|ave|avenue|blvd|lane|ln|dr|drive|court|ct|way|trail|trl)\b", re.IGNORECASE), "[ADDRESS]"),
        ]
        self.name_patterns = [
            re.compile(r"\bmy name is\s+[A-Za-z][A-Za-z' -]{1,40}\b", re.IGNORECASE),
            re.compile(r"\bi am\s+[A-Za-z][A-Za-z' -]{1,40}\b", re.IGNORECASE),
        ]

    def redact(self, text: str) -> str:
        redacted = text or ""
        for pattern, replacement in self.patterns:
            redacted = pattern.sub(replacement, redacted)

        for name_pattern in self.name_patterns:
            redacted = name_pattern.sub("[NAME]", redacted)

        return redacted


redaction_service = RedactionService()

