// Browser fixture: real prompt adapter with the application's packaged CSS.
import React from 'react'
import { createRoot } from 'react-dom/client'
import '@eyra/feldspar/dist/styles.css'
import { RadioInput } from '../../feldspar/src/framework/visualization/react/ui/prompts/radio_input'

const labels = [
  'Donate the selected records from my archive, including the descriptions that explain how each record was collected.',
  'Keep my records private and continue without donating any of the selected information from this archive.',
  'Review the information once more before deciding which records I would like to share with the researchers.',
]
createRoot(document.getElementById('root')!).render(
  <RadioInput locale="en" title="Choose how to continue" description="Select one option."
    items={labels.map((value, id) => ({ id, value, selected: false, onSelect() {} }))}
    resolve={payload => { document.body.dataset.result = JSON.stringify(payload) }} />,
)
