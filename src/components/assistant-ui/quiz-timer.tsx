"use client";

import { useEffect, useRef, useState } from "react";
import { useMessage, useThread, useThreadRuntime } from "@assistant-ui/react";

interface Props {
    timeLimit: number;
}

export function QuizTimer({ timeLimit }: Props) {
    // Reliable isLast: compare current message id against last message id in thread
    const messageId = useMessage((m) => m.id);
    const isLast = useThread((t) => {
        const msgs = t.messages;
        return msgs.length > 0 && msgs[msgs.length - 1].id === messageId;
    });
    const isRunning = useThread((t) => t.isRunning);
    const runtime = useThreadRuntime();

    const [timeLeft, setTimeLeft] = useState(timeLimit);
    const [answered, setAnswered] = useState(false);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    // Keep sendAnswer stable inside the interval closure
    const answeredRef = useRef(false);

    const isActive = isLast && !isRunning && !answered;

    // Tick down the counter
    useEffect(() => {
        if (!isActive) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            return;
        }
        intervalRef.current = setInterval(() => {
            setTimeLeft((t) => Math.max(0, t - 1));
        }, 1000);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [isActive]);

    // Handle expiration in a separate effect — no setState inside an updater
    useEffect(() => {
        if (timeLeft === 0 && isActive && !answeredRef.current) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            answeredRef.current = true;
            setAnswered(true);
            runtime.append({
                role: "user",
                content: [{ type: "text", text: "Čas vypršal – bez odpovede" }],
            });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [timeLeft, isActive]);

    function sendAnswer(answer: string) {
        if (answeredRef.current) return;
        answeredRef.current = true;
        setAnswered(true);
        if (intervalRef.current) clearInterval(intervalRef.current);
        runtime.append({
            role: "user",
            content: [{ type: "text", text: answer }],
        });
    }

    if (!isLast) return null;

    const progress = Math.max(0, (timeLeft / timeLimit) * 100);
    const urgency =
        timeLeft <= 10
            ? "urgent"
            : timeLeft <= Math.ceil(timeLimit * 0.4)
            ? "warn"
            : "safe";

    return (
        <div className="quiz-timer animate-message-enter">
            {!answered ? (
                <>
                    <div className="quiz-timer__bar-row">
                        <span className={`quiz-timer__count quiz-timer__count--${urgency}`}>
                            {timeLeft}s
                        </span>
                        <div className="quiz-timer__track">
                            <div
                                className={`quiz-timer__fill quiz-timer__fill--${urgency}`}
                                style={{ width: `${progress}%`, transition: "width 1s linear" }}
                            />
                        </div>
                    </div>

                    <div className="quiz-timer__btns">
                        {["A", "B", "C"].map((opt) => (
                            <button
                                key={opt}
                                className="quiz-opt-btn"
                                onClick={() => sendAnswer(opt)}
                            >
                                {opt}
                            </button>
                        ))}
                    </div>
                </>
            ) : (
                <p className="quiz-timer__sent">Odpoveď odoslaná</p>
            )}
        </div>
    );
}
