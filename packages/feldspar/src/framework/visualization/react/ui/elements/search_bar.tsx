import React, { JSX, useEffect, useMemo } from 'react'
import { TextField } from '@novasoftwarefoundation/prism-react'
import { Weak } from '../../../../helpers'
import { PropsUISearchBar } from '../../../../types/elements'
import _ from 'lodash'

export const SearchBar = ({ placeholder, debounce = 1000, onSearch }: Weak<PropsUISearchBar>): JSX.Element => {
  const search = useMemo(() => _.debounce((value: string) => onSearch(value.split(/\s+/)), debounce), [debounce, onSearch])
  useEffect(() => () => search.cancel(), [search])
  return (
    <form onSubmit={event => event.preventDefault()}>
      <TextField type="search" name="query" className="w-full" placeholder={placeholder} aria-label={placeholder}
        onChange={event => search(event.currentTarget.value)} />
    </form>
  )
}
