interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
}

const Modal = ({
  isOpen,
  onClose,
  onConfirm,
  title = '확인',
  message = '100포인트를 구매하시겠습니까?',
}: ModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-800/50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-6 w-80 shadow-lg">
        <h2 className="text-xl font-bold mb-4">{title}</h2>
        <p className="mb-6">{message}</p>
        <div className="flex justify-end gap-4">
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">
            취소
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            구매
          </button>
        </div>
      </div>
    </div>
  );
};

export default Modal;
