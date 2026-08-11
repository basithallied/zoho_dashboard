import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { FileSearch, X } from 'lucide-react';
import { api, titleCase } from '../api';
import { EmptyState, Loading } from './ui';

/**
 * Source-record drill-through.
 *
 * Any figure anywhere in the app can call `openRecord(entityType, entityId)`
 * to show the row it was computed from — that is what "every figure links to
 * the records behind it" means in practice.
 */
const SourceRecordContext = createContext({ openRecord: () => {} });

export function useSourceRecords() {
  return useContext(SourceRecordContext);
}

export function SourceRecordProvider({ children }) {
  const [target, setTarget] = useState(null);

  const openRecord = useCallback((entityType, entityId) => {
    setTarget({ entityType, entityId });
  }, []);

  return (
    <SourceRecordContext.Provider value={{ openRecord }}>
      {children}
      {target && <SourceRecordDrawer target={target} onClose={() => setTarget(null)} />}
    </SourceRecordContext.Provider>
  );
}

function SourceRecordDrawer({ target, onClose }) {
  const [record, setRecord] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setRecord(null);
    setError(null);
    api
      .get(`/records/${encodeURIComponent(target.entityType)}/${encodeURIComponent(target.entityId)}`)
      .then((data) => active && setRecord(data))
      .catch((err) => active && setError(err.message));
    return () => {
      active = false;
    };
  }, [target.entityType, target.entityId]);

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(event) => event.stopPropagation()}>
        <div className="card-head">
          <div>
            <h3>{titleCase(target.entityType)}</h3>
            <div className="sub mono">{target.entityId}</div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
            <X size={17} />
          </button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {error && <EmptyState message={error} icon={FileSearch} />}
          {!record && !error && <Loading label="Opening source record…" />}
          {record && (
            <div className="card-body">
              <p className="small muted" style={{ marginBottom: 12 }}>
                Read directly from the connected system. The agent does not modify source records.
              </p>
              {Object.entries(record.fields).map(([key, value]) => (
                <div className="kv" key={key} style={{ borderBottom: '1px solid var(--border)' }}>
                  <span className="k">{titleCase(key)}</span>
                  <span className="v mono">{value === null || value === '' ? '—' : String(value)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

export function SourceList({ refs = [], limit = 6 }) {
  const { openRecord } = useSourceRecords();
  const [expanded, setExpanded] = useState(false);
  if (!refs.length) return <span className="small faint">No source records</span>;

  const visible = expanded ? refs : refs.slice(0, limit);
  return (
    <div className="row wrap" style={{ gap: 6 }}>
      {visible.map((ref, index) => (
        <button
          key={`${ref.entity_type}-${ref.entity_id}-${index}`}
          className="chip"
          onClick={() => openRecord(ref.entity_type, ref.entity_id)}
          title={`Open ${ref.entity_type} ${ref.entity_id}`}
        >
          {ref.label || ref.entity_id}
        </button>
      ))}
      {refs.length > limit && (
        <button className="link-button" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Show fewer' : `+${refs.length - limit} more`}
        </button>
      )}
    </div>
  );
}
