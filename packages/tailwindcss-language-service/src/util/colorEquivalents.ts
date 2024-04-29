import type { State } from './state'
import type { Plugin } from 'postcss'
import parseValue from 'postcss-value-parser'
import { inGamut } from 'culori'
import { formatColor, getColorFromValue } from './color'
import type { Comment } from './comments'

const TW_REGEX = /--twc-(\w+)-(\d+)/
let allowedFunctions = ['rgb', 'rgba', 'hsl', 'hsla', 'lch', 'lab', 'oklch', 'oklab']

export function equivalentColorValues(state: State, { comments }: { comments: Comment[] }): Plugin {
  return {
    postcssPlugin: 'plugin',
    Declaration(decl) {
      if (!allowedFunctions.some((fn) => decl.value.includes(fn))) {
        return
      }

      parseValue(decl.value).walk((node) => {
        if (node.type !== 'function') {
          return true
        }

        if (!allowedFunctions.includes(node.value)) {
          return false
        }

        const twcNode = node.nodes.filter(
          (n) => n.type === 'function' && n.nodes.length && n.nodes[0].value.startsWith('--twc-'),
        )
        if (twcNode) {
          const res = decl.value.match(TW_REGEX)
          if (res) {
            const [, color, value] = res
            const light = state.config.theme.colors[color][value]
            const dark = state.config.theme.darkColors[color][value]

            comments.push({
              index:
                decl.source.start.offset +
                `${decl.prop}${decl.raws.between}`.length +
                node.sourceEndIndex,
              value: `${light} ${dark}`,
            })

            return false
          }
        }

        const values = node.nodes.filter((n) => n.type === 'word').map((n) => n.value)
        if (values.length < 3) {
          return false
        }

        const color = getColorFromValue(`${node.value}(${values.join(' ')})`)

        if (!inGamut('rgb')(color)) {
          return false
        }

        if (!color || typeof color === 'string') {
          return false
        }

        comments.push({
          index:
            decl.source.start.offset +
            `${decl.prop}${decl.raws.between}`.length +
            node.sourceEndIndex,
          value: formatColor(color),
        })

        return false
      })
    },
  }
}
equivalentColorValues.postcss = true
