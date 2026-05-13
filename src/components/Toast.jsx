export default function Toast({ toasts, onClose }) {
  return (
    <div className="toast-wrap">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast ${toast.type || "info"}`}>
          <div>
            <strong>{toast.title}</strong>
            {toast.message && <p>{toast.message}</p>}
          </div>
          <button onClick={() => onClose(toast.id)}>x</button>
        </div>
      ))}
    </div>
  );
}
