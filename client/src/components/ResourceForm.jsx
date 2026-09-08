import { useMemo, useState } from 'react';
import { useResourceMutations } from '../lib/useResource.js';
import { useToast } from './Toast.jsx';
import { Modal } from './Modal.jsx';
import { ModalFooter, useForm } from './form.jsx';

/**
 * Modal-wrapped create/edit form for a resource. Handles the mutation,
 * toasts and error surfacing; the caller supplies the field markup via children
 * (a render prop receiving the form helpers).
 */
export function ResourceForm({
  resource,
  editing,
  onClose,
  onSaved,
  title,
  size = 'modal-lg',
  initial,
  fromRow,
  toPayload = (v) => v,
  validate,
  children,
}) {
  const toast = useToast();
  const { create, update } = useResourceMutations(resource);
  const isEdit = !!editing;

  const startValues = useMemo(() => {
    if (!isEdit) return initial;
    const picked = {};
    for (const key of Object.keys(initial)) picked[key] = editing[key] ?? initial[key];
    return fromRow ? { ...picked, ...fromRow(editing) } : picked;
  }, [isEdit, editing]); // eslint-disable-line react-hooks/exhaustive-deps

  const form = useForm(startValues);
  const [err, setErr] = useState('');
  const saving = create.isPending || update.isPending;

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (validate) {
      const v = validate(form.values);
      if (v) {
        setErr(v);
        return;
      }
    }
    try {
      const payload = toPayload(form.values);
      if (isEdit) await update.mutateAsync({ id: editing.id, ...payload });
      else await create.mutateAsync(payload);
      onSaved(`${title} ${isEdit ? 'updated' : 'added'} successfully`);
    } catch (e2) {
      setErr(e2.message || 'Failed to save');
      toast(e2.message || 'Failed to save', 'error');
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`${isEdit ? 'Edit' : 'Add'} ${title}`}
      size={size}
      footer={<ModalFooter onCancel={onClose} saving={saving} saveLabel={`Save ${title}`} />}
    >
      <form id="resource-form" onSubmit={submit}>
        {err && (
          <div className="alert-item alert-danger" style={{ marginBottom: 14 }}>
            <i className="fas fa-exclamation-circle" />
            <div className="alert-content">{err}</div>
          </div>
        )}
        {children(form)}
        {/* allow footer button (outside form) to submit */}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
