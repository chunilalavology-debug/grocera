import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api from '../../services/api';
import toast, { Toaster } from 'react-hot-toast';
import { ArrowLeft, Mail, Send, Trash2, RotateCcw } from 'lucide-react';
import './AdminMessages.css';

function formatDateFull(dateString) {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdminMessageDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const load = useCallback(async () => {
    const raw = id != null ? String(id).trim() : '';
    if (!raw) {
      setMsg(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      try {
        const response = await api.get(`/admin/messages/${encodeURIComponent(raw)}`);
        if (response?.success && response.data) {
          setMsg(response.data);
          setReplyText(response.data.response || '');
          return;
        }
        setMsg(null);
        toast.error(
          response?.success === false && response?.message
            ? String(response.message)
            : 'Message not found'
        );
      } catch (e1) {
        try {
          const r2 = await api.get(`/admin/contacts/${encodeURIComponent(raw)}`);
          if (r2?.contact) {
            setMsg(r2.contact);
            setReplyText(r2.contact.response || '');
            return;
          }
        } catch (e2) {
          setMsg(null);
          toast.error(e2?.message || e1?.message || 'Could not load message');
          return;
        }
        setMsg(null);
        toast.error(e1?.message || 'Message not found');
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const mailtoHref =
    msg && msg.email
      ? `mailto:${encodeURIComponent(msg.email)}?subject=${encodeURIComponent(`Re: ${msg.subject || ''}`)}`
      : '#';

  const handleReply = async () => {
    if (!msg || !replyText.trim()) {
      toast.error('Reply message cannot be empty');
      return;
    }
    setSending(true);
    const loadingToast = toast.loading('Sending reply...');
    try {
      const response = await api.post('/admin/messages/reply', {
        id: String(msg._id),
        replyMessage: replyText.trim(),
      });
      if (response.success) {
        toast.dismiss(loadingToast);
        toast.success('Reply sent successfully');
        navigate('/admin/messages', { replace: true });
      }
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error(error.message || 'Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  const inTrash = Boolean(msg?.inTrash);

  const handleMoveToTrash = async () => {
    if (!msg?._id) return;
    if (!window.confirm('Move this message to Trash? You can restore it from the Trash tab.')) return;
    setDeleting(true);
    try {
      const res = await api.post('/admin/messages/delete-many', { ids: [String(msg._id)] });
      if (res?.success) {
        toast.success('Moved to Trash');
        navigate('/admin/messages', { replace: true });
      } else if (res?.message) {
        toast.error(String(res.message));
      }
    } catch (e) {
      toast.error(
        e?.message ||
          'Could not move to Trash — check API URL (REACT_APP_API_URL or REACT_APP_SAME_ORIGIN_API).'
      );
    } finally {
      setDeleting(false);
    }
  };

  const handleRestore = async () => {
    if (!msg?._id) return;
    setRestoring(true);
    try {
      const res = await api.post('/admin/messages/restore-many', { ids: [String(msg._id)] });
      if (res?.success) {
        toast.success('Message restored to inbox');
        await load();
      } else if (res?.message) {
        toast.error(String(res.message));
      }
    } catch (e) {
      toast.error(e?.message || 'Restore failed');
    } finally {
      setRestoring(false);
    }
  };

  const handlePermanentDelete = async () => {
    if (!msg?._id) return;
    if (!window.confirm('Permanently delete this message? This cannot be undone.')) return;
    setDeleting(true);
    try {
      const res = await api.post('/admin/messages/permanent-delete-many', { ids: [String(msg._id)] });
      if (res?.success) {
        toast.success('Message permanently deleted');
        navigate('/admin/messages', { replace: true });
      } else if (res?.message) {
        toast.error(String(res.message));
      }
    } catch (e) {
      toast.error(e?.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-msg-bleed admin-design-scope font-sans">
        <Toaster position="top-right" />
        <div className="admin-msg-detail__toolbar">
          <Link to="/admin/messages" className="admin-msg-detail__back">
            <ArrowLeft size={20} />
            Back
          </Link>
        </div>
        <div className="admin-msg-inbox__loading">
          <div className="admin-msg-inbox__spinner" />
          <p>Loading message…</p>
        </div>
      </div>
    );
  }

  if (!msg) {
    return (
      <div className="admin-msg-bleed admin-design-scope font-sans px-4 py-8 sm:px-6">
        <Toaster position="top-right" />
        <Link to="/admin/messages" className="admin-msg-detail__back inline-flex mb-6">
          <ArrowLeft size={20} />
          Back to inbox
        </Link>
        <p className="text-gray-600 text-base">We could not load this message. It may have been deleted, or the link is invalid.</p>
      </div>
    );
  }

  return (
    <div className="admin-msg-bleed admin-design-scope font-sans">
      <Toaster position="top-right" />
      <div className="admin-msg-detail__toolbar">
        <button type="button" className="admin-msg-detail__back" onClick={() => navigate('/admin/messages')}>
          <ArrowLeft size={20} />
          Back to inbox
        </button>
        <div className="admin-msg-detail__toolbar-actions">
          <a
            href={mailtoHref}
            className="admin-msg-detail__mailto"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Mail size={18} />
            <span className="hidden sm:inline">Open in mail</span>
          </a>
          {inTrash ? (
            <>
              <button
                type="button"
                className="admin-msg-detail__btn admin-msg-detail__btn--ghost"
                onClick={() => void handleRestore()}
                disabled={restoring}
              >
                <RotateCcw size={18} />
                {restoring ? 'Restoring…' : 'Restore'}
              </button>
              <button
                type="button"
                className="admin-msg-detail__btn--danger"
                onClick={() => void handlePermanentDelete()}
                disabled={deleting}
              >
                <Trash2 size={18} />
                {deleting ? 'Deleting…' : 'Delete forever'}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="admin-msg-detail__btn--danger"
              onClick={() => void handleMoveToTrash()}
              disabled={deleting}
            >
              <Trash2 size={18} />
              {deleting ? 'Moving…' : 'Trash'}
            </button>
          )}
        </div>
      </div>

      <div className="admin-msg-detail__body">
        {inTrash ? (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            This message is in <strong>Trash</strong>. Restore it to reply from the dashboard, or delete it forever.
          </p>
        ) : null}
        <h1 className="admin-msg-detail__subject">{msg.subject || '(No subject)'}</h1>
        <div className="admin-msg-detail__meta">
          <div>
            <span className="admin-msg-detail__meta-label">From</span>
            <span className="admin-msg-detail__meta-value">
              {msg.name || '—'} &lt;{msg.email || '—'}&gt;
            </span>
          </div>
          {msg.phone ? (
            <div>
              <span className="admin-msg-detail__meta-label">Phone</span>
              <span className="admin-msg-detail__meta-value">{msg.phone}</span>
            </div>
          ) : null}
          {msg.queryType ? (
            <div>
              <span className="admin-msg-detail__meta-label">Type</span>
              <span className="admin-msg-detail__meta-value">{msg.queryType}</span>
            </div>
          ) : null}
          <div>
            <span className="admin-msg-detail__meta-label">Date</span>
            <span className="admin-msg-detail__meta-value">{formatDateFull(msg.createdAt)}</span>
          </div>
          <div>
            <span className="admin-msg-detail__meta-label">Status</span>
            <span className="admin-msg-detail__meta-value capitalize">{msg.status}</span>
          </div>
        </div>

        <div className="admin-msg-detail__message">{msg.message}</div>

        {msg.autoAcknowledgment ? (
          <div className="admin-msg-detail__sent-reply">
            <div className="admin-msg-detail__meta-label mb-2">Automatic thank-you (sent to the customer)</div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-base whitespace-pre-wrap text-slate-800">
              {msg.autoAcknowledgment}
            </div>
            <p className="mt-2 text-sm text-slate-500">
              This message is sent by email when the contact form is submitted. You can still send a personal reply below.
            </p>
          </div>
        ) : null}

        {msg.status === 'responded' && msg.response ? (
          <div className="admin-msg-detail__sent-reply">
            <div className="admin-msg-detail__meta-label mb-2">Your reply (sent)</div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-base whitespace-pre-wrap">
              {msg.response}
            </div>
          </div>
        ) : null}

        {!inTrash && msg.status !== 'responded' ? (
          <div className="admin-msg-detail__reply">
            <div className="admin-msg-detail__meta-label mb-2">Reply by email (sent from your store mailer)</div>
            <textarea
              className="admin-msg-detail__textarea"
              placeholder="Write your reply…"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              rows={8}
            />
            <div className="admin-msg-detail__actions">
              <button
                type="button"
                className="admin-msg-detail__btn admin-msg-detail__btn--ghost"
                onClick={() => navigate('/admin/messages')}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-msg-detail__btn admin-msg-detail__btn--primary"
                onClick={() => void handleReply()}
                disabled={sending}
              >
                <Send size={18} />
                Send reply
              </button>
            </div>
          </div>
        ) : (
          <p className="text-base text-gray-500 mt-6">
            {msg.autoAcknowledgment
              ? 'A personal reply was sent from the dashboard (in addition to the automatic thank-you above).'
              : 'This thread was replied to from the dashboard.'}
          </p>
        )}
      </div>
    </div>
  );
}
