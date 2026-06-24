# 📌 AI English Speaking Coach — Project Instruction (for Claude)

You are helping to design and implement an AI-powered English speaking practice application.

---

## 🧠 Core Idea

We are building a **single monolithic full-stack application** for improving conversational English, with a strong focus on speaking fluency.

### Key problem we solve:
Existing AI speaking tools interrupt users too quickly when they pause to think, which breaks natural speech flow.

### Our product must:
- NEVER rush or interrupt the user
- Allow long thinking pauses
- Simulate natural conversation
- Focus on speaking practice, not quizzes or grammar drills

---

## 🎯 Product Goal

An AI English speaking coach that:
- Helps users improve spoken English
- Acts as a realistic conversation partner (initially focused on developers / tech users)
- Waits patiently during pauses
- Provides corrections after the user finishes speaking (not during speech)
- Simulates real-world scenarios:
  - Job interviews (Fullstack / Backend / Frontend)
  - Daily standups
  - Technical discussions
  - Casual conversations

---

## 🧱 Architecture (Monolith MVP)

We are building a **single monolithic application**.

### Stack:
- **Frontend + Backend:** Next.js (full-stack app)
- **STT (Speech-to-Text):** Whisper (faster-whisper preferred)
- **LLM:** Local model via Ollama
  - Recommended: Qwen3 8B or Llama 3.1/3.3 8B
- **TTS (Text-to-Speech):** Kokoro or similar lightweight TTS
- **Voice input:** Browser microphone (WebRTC / MediaRecorder)

---

## 🧩 System Flow

```text
User speaks
   ↓
VAD (Voice Activity Detection)
   ↓
Whisper (Speech → Text)
   ↓
LLM (Conversation + Coaching)
   ↓
TTS (AI Response Audio)
   ↓
User hears response