import { useState } from 'react';

const CHEAT_SHEET_IMAGE = `${import.meta.env.BASE_URL}images/alfabeto-manual-libras.png`;

export function AlphabetCheatSheet() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasImageError, setHasImageError] = useState(false);

  const openSheet = () => {
    setHasImageError(false);
    setIsOpen(true);
  };

  const closeSheet = () => {
    setIsOpen(false);
  };

  return (
    <>
      {!isOpen && (
        <button
          type="button"
          className="cheat-sheet-launcher"
          onClick={openSheet}
          aria-expanded={isOpen}
          aria-controls="alphabet-cheat-sheet"
        >
          Cola
        </button>
      )}

      {isOpen && (
        <div className="cheat-sheet-backdrop" role="presentation" onClick={closeSheet}>
          <aside
            id="alphabet-cheat-sheet"
            className="cheat-sheet-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Cola do alfabeto manual em LIBRAS"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="cheat-sheet-header">
              <div>
                <p className="cheat-sheet-kicker">Cola</p>
                <h2>Alfabeto manual em LIBRAS</h2>
              </div>
              <button
                type="button"
                className="cheat-sheet-close"
                onClick={closeSheet}
                aria-label="Fechar cola"
              >
                x
              </button>
            </div>

            <div className="cheat-sheet-body">
              {!hasImageError ? (
                <img
                  src={CHEAT_SHEET_IMAGE}
                  alt="Cola do alfabeto manual em LIBRAS"
                  className="cheat-sheet-image"
                  onError={() => setHasImageError(true)}
                />
              ) : (
                <div className="cheat-sheet-empty" aria-live="polite">
                  <p>Coloque a imagem em public/images/alfabeto-manual-libras.png.</p>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
