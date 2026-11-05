import React from "react"
import { Button } from "@novasoftwarefoundation/prism-react"
import { JSX } from "react"

interface PropsUIPageIcon {
  index: number
  selected: boolean
  onClick: () => void
}

type Props = PropsUIPageIcon

export const PageIcon = ({ index, selected, onClick }: Props): JSX.Element => {
  function width (): string {
    if (index > 999) return 'w-10'
    if (index > 99) return 'w-9'
    return 'w-8'
  }

  return (
    <Button type="button" variant="soft" tone={selected ? 'accent' : 'neutral'}
      className={`${width()} h-8 shrink-0 ${selected ? 'bg-primary text-white' : 'bg-grey5 text-grey2'}`} aria-current={selected ? 'page' : undefined} onClick={onClick}>
      {index}
    </Button>
  )
}
