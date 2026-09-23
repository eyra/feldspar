import React, { JSX, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import TextBundle from '../../../../text_bundle'
import { Translator } from '../../../../translator'

interface Props {
  text: string
  field: string
  locale: string
}

export const TableCellText = ({ text, field, locale }: Props): JSX.Element => {
  const previewRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [clipped, setClipped] = useState(false)
  const [open, setOpen] = useState(false)

  useLayoutEffect(() => {
    const preview = previewRef.current
    if (preview === null) return

    let active = true
    const measure = (): void => {
      if (!active) return
      // Desktop and mobile tables are both mounted; measure only visible cells.
      if (preview.clientWidth === 0 || preview.scrollHeight <= preview.clientHeight) {
        setClipped(false)
        return
      }

      // Glyph overflow can increase scrollHeight without hiding any lines.
      // Only offer the reader when removing the clamp reveals more text height.
      const clampedHeight = preview.getBoundingClientRect().height
      const lineClamp = preview.style.webkitLineClamp
      preview.style.webkitLineClamp = 'unset'
      const fullHeight = preview.getBoundingClientRect().height
      preview.style.webkitLineClamp = lineClamp
      setClipped(fullHeight > clampedHeight)
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(preview)
    if (document.fonts.status === 'loading') void document.fonts.ready.then(measure)

    return () => {
      active = false
      observer.disconnect()
    }
  }, [text])

  return (
    <div className='min-w-0 font-table-row text-table text-grey1'>
      <div ref={previewRef} className='table-text-preview'>{text}</div>
      {clipped && (
        <button
          ref={triggerRef}
          type='button'
          className='table-text-action text-primary underline text-left'
          aria-haspopup='dialog'
          onClick={() => setOpen(true)}
        >
          {Translator.translate(readFullText, locale)}
        </button>
      )}
      {open && (
        <FullTextDialog
          text={text}
          field={field}
          locale={locale}
          onClose={() => {
            setOpen(false)
            triggerRef.current?.focus({ preventScroll: true })
          }}
        />
      )}
    </div>
  )
}

const FullTextDialog = ({ text, field, locale, onClose }: Props & { onClose: () => void }): JSX.Element => {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const hasField = field.trim().length > 0
  const fullTextLabel = Translator.translate(fullText, locale)

  useLayoutEffect(() => {
    const dialog = dialogRef.current
    if (dialog === null) return

    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.showModal()

    return () => {
      document.body.style.overflow = overflow
    }
  }, [])

  // A portal keeps the dialog visible if the responsive table switches while open.
  return createPortal(
    <dialog ref={dialogRef} className='table-text-dialog text-grey1 bg-white' aria-labelledby={titleId} onClose={onClose}>
      <header className='table-text-dialog-header border-b border-grey4'>
        <h2 id={titleId} className='min-w-0 flex flex-wrap items-baseline gap-x-2 gap-y-1 [overflow-wrap:anywhere]'>
          <span className='min-w-0 font-title6 text-title6'>{hasField ? field : fullTextLabel}</span>
          {hasField && (
            <>
              {' '}
              <span className='font-caption text-caption text-grey2'>{fullTextLabel}</span>
            </>
          )}
        </h2>
        <button
          type='button'
          autoFocus
          className='table-text-action shrink-0 text-primary font-button text-buttonsmall'
          onClick={() => dialogRef.current?.close()}
        >
          {Translator.translate(close, locale)}
        </button>
      </header>
      <div className='table-text-dialog-body font-body text-bodysmall' tabIndex={0}>{text}</div>
    </dialog>,
    document.body
  )
}

const readFullText = new TextBundle()
  .add('en', 'Read full text')
  .add('de', 'Vollständigen Text lesen')
  .add('it', 'Leggi il testo completo')
  .add('es', 'Leer el texto completo')
  .add('nl', 'Lees volledige tekst')
  .add('ro', 'Citiți textul complet')
  .add('lt', 'Skaityti visą tekstą')

const fullText = new TextBundle()
  .add('en', 'Full text')
  .add('de', 'Vollständiger Text')
  .add('it', 'Testo completo')
  .add('es', 'Texto completo')
  .add('nl', 'Volledige tekst')
  .add('ro', 'Text complet')
  .add('lt', 'Visas tekstas')

const close = new TextBundle()
  .add('en', 'Close')
  .add('de', 'Schließen')
  .add('it', 'Chiudi')
  .add('es', 'Cerrar')
  .add('nl', 'Sluiten')
  .add('ro', 'Închideți')
  .add('lt', 'Uždaryti')
