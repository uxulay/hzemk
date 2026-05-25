"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  getAppNotifications,
  type AppNotification
} from "@/lib/api/notifications";
import { useMockRole } from "@/components/auth/mock-role-provider";
import { BellIcon } from "@/components/ui/icons";

function getReadStorageKey(role: string) {
  return `hzemk-read-notifications-${role}`;
}

function readStoredIds(role: string) {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    return JSON.parse(window.localStorage.getItem(getReadStorageKey(role)) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function storeReadIds(role: string, ids: string[]) {
  window.localStorage.setItem(getReadStorageKey(role), JSON.stringify(ids));
}

export function NotificationDropdown() {
  const { user } = useMockRole();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [readIds, setReadIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !readIds.includes(item.id)).length,
    [notifications, readIds]
  );

  useEffect(() => {
    setReadIds(readStoredIds(user.role));
  }, [user.role]);

  useEffect(() => {
    const loadNotifications = async () => {
      try {
        setLoading(true);
        setNotifications(await getAppNotifications(user.role));
      } finally {
        setLoading(false);
      }
    };

    loadNotifications();
  }, [user.role]);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  const markAllRead = () => {
    const ids = notifications.map((item) => item.id);
    setReadIds(ids);
    storeReadIds(user.role, ids);
  };

  const markOneRead = (id: string) => {
    setReadIds((current) => {
      const next = Array.from(new Set([...current, id]));
      storeReadIds(user.role, next);
      return next;
    });
    setOpen(false);
  };

  return (
    <div className="notificationWrapper" ref={wrapperRef}>
      <button
        className="iconButton"
        type="button"
        aria-label="通知"
        onClick={() => setOpen((current) => !current)}
      >
        <BellIcon size={18} />
        {unreadCount > 0 ? (
          <span className="notificationDot">{unreadCount}</span>
        ) : null}
      </button>

      {open ? (
        <div className="notificationPanel">
          <div className="notificationPanelHeader">
            <div>
              <strong>通知中心</strong>
              <span>{unreadCount} 条未读</span>
            </div>
            <button type="button" onClick={markAllRead} disabled={!notifications.length}>
              全部标记已读
            </button>
          </div>

          {loading ? <div className="globalSearchState">正在读取通知...</div> : null}

          {!loading && notifications.length === 0 ? (
            <div className="globalSearchState">暂无通知</div>
          ) : null}

          {!loading && notifications.length > 0 ? (
            <div className="notificationList">
              {notifications.map((item) => {
                const unread = !readIds.includes(item.id);

                return (
                  <Link
                    className={`notificationItem notificationItem-${item.tone} ${unread ? "unread" : ""}`}
                    href={item.href}
                    key={item.id}
                    onClick={() => markOneRead(item.id)}
                  >
                    <span className="notificationTypeDot" />
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.description}</p>
                      <small>{item.timeLabel}</small>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : null}

          <div className="notificationPanelFooter">
            <Link href="/dashboard" onClick={() => setOpen(false)}>
              查看全部
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
