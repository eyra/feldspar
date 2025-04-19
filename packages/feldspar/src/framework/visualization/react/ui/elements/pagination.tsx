import _ from 'lodash'
import React, { JSX } from 'react'
import { Weak } from '../../../../helpers'
import { PropsUIPagination } from '../../../../types/elements'
import { BackIconButton, ForwardIconButton } from './button'
import { PageIcon } from './page_icon'

type Props = Weak<PropsUIPagination> & PaginationContext

export interface PaginationContext {
  onChange: (page: number) => void
}

export const Pagination = ({ pageCount, page, pageWindowLegSize, onChange }: Props): JSX.Element => {
  const pageWindow = updatePageWindow(pageCount, page)

  function renderPageIcons (): JSX.Element {
    return (
      <div className='flex flex-row gap-2'>
        {pageWindow.map((page) => renderPageIcon(page))}
      </div>
    )
  }

  function renderPageIcon (index: number): JSX.Element {
    return (
      <PageIcon
        key={`page-${index}`}
        index={index + 1}
        selected={page === index}
        onClick={() => handleNewPage(index)}
      />
    )
  }

  function handleNewPage (page: number): void {
    onChange(page)
  }

  function handlePrevious (): void {
    const previousPage = page === 0 ? pageCount - 1 : page - 1
    onChange(previousPage)
  }

  function handleNext (): void {
    const nextPage = page === pageCount - 1 ? 0 : page + 1
    onChange(nextPage)
  }

  function updatePageWindow (pageCount: number, currentPage: number): number[] {
    const pageWindowSize = pageWindowLegSize * 2 + 1

    let range: number[] = []
    if (pageWindowSize >= pageCount && pageCount > 0) {
      range = _.range(0, Math.min(pageCount, pageWindowSize))
    } else if (pageWindowSize < pageCount) {
      const maxIndex = pageCount - 1

      let start: number
      let end: number

      if (currentPage < pageWindowLegSize) {
        // begin
        start = 0
        end = Math.min(pageCount, pageWindowSize)
      } else if (maxIndex - currentPage <= pageWindowLegSize) {
        // end
        start = maxIndex - (pageWindowSize - 1)
        end = maxIndex + 1
      } else {
        // middle
        start = currentPage - pageWindowLegSize
        end = currentPage + pageWindowLegSize + 1
      }
      range = _.range(start, end)
    }

    return range
  }

  return (
    <div className='flex flex-row items-center gap-2 mt-2'>
      <div className='flex-grow' />
      <BackIconButton onClick={handlePrevious} />
      <div>{renderPageIcons()}</div>
      <ForwardIconButton onClick={handleNext} />
      <div className='flex-grow' />
    </div>
  )
}
