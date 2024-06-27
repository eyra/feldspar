import { Weak } from '../../../../helpers'
import { PropsUIProgressBar } from '../../../../types/elements'

type Props = Weak<PropsUIProgressBar>

export const ProgressBar = ({ percentage }: Props): JSX.Element => {
  return (
    <div id='progress' className='relative w-full overflow-hidden rounded-full'>
      <div className='flex flex-row items-center gap-4'>
        <div className='flex-grow h-4 bg-primarylight' />
      </div>
      <div className='absolute top-0 h-4 bg-primary' style={{ width: `${percentage}%` }} />
    </div>
  )
}
