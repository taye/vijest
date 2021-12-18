import set from 'lodash/set'

import { PAGE_METHODS } from '../../constants'
import reporter from '../remoteReporter'

const vt = {
  debugger: () => reporter.debugger(),
  ...[...PAGE_METHODS].reduce((acc, method) => {
    const path = method.split('.')
    set(acc, path, (...args: unknown[]) => reporter.pageMethod({ path, args }))
    return acc
    // eslint-disable-next-line @typescript-eslint/ban-types
  }, {} as Record<string, Function | Record<string, Function>>),
}

export default vt
