import React from 'react'
import { createRoot } from 'react-dom/client'
import { TableFactory } from '../../feldspar/src/framework/visualization/react/ui/prompts/factory'
import type { PropsUIPromptConsentFormTable } from '../../feldspar/src/framework/types/prompts'
import '@eyra/feldspar/dist/styles.css'

// Exercise the real consent factory and serializer without a Python download.
const params = new URLSearchParams(location.search)
const locale = params.get('locale') ?? 'en'
const text = (en: string, nl: string) => ({ translations: params.has('noDutch') ? { en } : { en, nl } })
const body: PropsUIPromptConsentFormTable = {
  __type__: 'PropsUIPromptConsentFormTable', id: 'locale-check', number: 1,
  title: text('Conversation data', 'Gespreksgegevens'),
  description: text('Review your messages.', 'Controleer uw berichten.'),
  data_frame: JSON.stringify({
    role: { 0: 'user', 1: 'assistant' },
    message: { 0: 'A synthetic message. '.repeat(70), 1: 'A synthetic reply.' },
    model: { 0: 'test-model', 1: 'test-model' }
  }),
  headers: params.has('legacy') ? undefined : {
    role: text('Role', 'Rol'), message: text('Message', 'Bericht'), model: text('Model', 'Model')
  },
  column_widths: params.has('legacy') ? undefined : { message: 4 }
}
const submission = document.createElement('output')
submission.dataset.testid = 'donation'
submission.hidden = true
document.body.append(submission)
const element = new TableFactory().create(body, {
  locale,
  onDataSubmissionDataChanged: (_id, value) => { submission.textContent = JSON.stringify(value) },
  onDonate: () => {}
})
createRoot(document.getElementById('root')!).render(
  <main style={{ maxWidth: 1100, margin: '24px auto', padding: 16 }}>{element}</main>
)
