import { useHistory } from 'react-router-dom'
import React, { useCallback, useMemo, useState } from 'react'
import { Container } from '@harness/uicore'
import cx from 'classnames'
import MarkdownPreview from '@uiw/react-markdown-preview'
import rehypeVideo from 'rehype-video'
import rehypeExternalLinks from 'rehype-external-links'
import { INITIAL_ZOOM_LEVEL } from 'utils/Utils'
import ImageCarousel from 'components/ImageCarousel/ImageCarousel'
import css from './MarkdownViewer.module.scss'

interface MarkdownViewerProps {
  source: string
  className?: string
  maxHeight?: string | number
}

export function MarkdownViewer({ source, className, maxHeight }: MarkdownViewerProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false)
  const history = useHistory()
  const [zoomLevel, setZoomLevel] = useState(INITIAL_ZOOM_LEVEL)
  const [imgEvent, setImageEvent] = useState<string[]>([])
  const refRootHref = useMemo(() => document.getElementById('repository-ref-root')?.getAttribute('href'), [])
  const interceptClickEventOnViewerContainer = useCallback(
    event => {
      const { target } = event
      const imgPattern = /!\[.*?\]\((.*?)\)/;
      const imageArray = source.split('\n').filter(string => imgPattern.test(string))
      const imageStringArray = imageArray.map(string => {
        const match = string.match(imgPattern);
        return match ? match[1] : '';
      })

      setImageEvent(imageStringArray)

      if (target?.tagName?.toLowerCase() === 'a') {
        const href = target.getAttribute('href')

        // Intercept click event on internal links and navigate to pages to avoid full page reload
        if (href) {
          try {
            const url = new URL(target.href)

            if (url.origin === window.location.origin) {
              event.stopPropagation()
              event.preventDefault()

              if (href.startsWith('#')) {
                document.getElementById(href.slice(1))?.scrollIntoView()
              } else {
                history.push(url.pathname)
              }
            }
          } catch (e) {
            // eslint-disable-next-line no-console
            console.error('Error: MarkdownViewer/interceptClickEventOnViewerContainer', e)
          }
        }
      } else if (event.target.nodeName?.toLowerCase() === 'img') {
        setIsOpen(true)
      }
    },
    [history, source]
  )

  return (
    <Container
      className={cx(css.main, className, { [css.withMaxHeight]: maxHeight && maxHeight > 0 })}
      onClick={interceptClickEventOnViewerContainer}
      style={{ maxHeight: maxHeight }}>
      <MarkdownPreview
        source={source}
        skipHtml={true}
        warpperElement={{ 'data-color-mode': 'light' }}
        rehypeRewrite={(node, _index, parent) => {
          if ((node as unknown as HTMLDivElement).tagName === 'a') {
            if (parent && /^h(1|2|3|4|5|6)/.test((parent as unknown as HTMLDivElement).tagName)) {
              parent.children = parent.children.slice(1)
            }

            // Rewrite a.href to point to the correct location for relative links to files inside repository.
            // Relative links are defined as links that do not start with /, #, https:, http:, mailto:,
            // tel:, data:, javascript:, sms:, or http(s):
            if (refRootHref) {
              const { properties } = node as unknown as { properties: { href: string } }
              let href: string = properties.href

              if (
                href &&
                !href.startsWith('/') &&
                !href.startsWith('#') &&
                !href.startsWith('https:') &&
                !href.startsWith('http:') &&
                !href.startsWith('mailto:') &&
                !href.startsWith('tel:') &&
                !href.startsWith('data:') &&
                !href.startsWith('javascript:') &&
                !href.startsWith('sms:') &&
                !/^http(s)?:/.test(href)
              ) {
                try {
                  // Some relative links are prefixed by `./`, normalize them
                  if (href.startsWith('./')) {
                    href = properties.href = properties.href.replace('./', '')
                  }

                  // Test if the link is relative to the current page.
                  // If true, rewrite it to point to the correct location
                  if (new URL(window.location.href + '/' + href).origin === window.location.origin) {
                    properties.href = (refRootHref + '/~/' + href).replace(/^\/ng\//, '/')
                  }
                } catch (_exception) {
                  // eslint-disable-line no-empty
                }
              }
            }
          }
        }}
        rehypePlugins={[
          rehypeVideo,
          [rehypeExternalLinks, { rel: ['nofollow noreferrer noopener'], target: '_blank' }]
        ]}
      />
      <ImageCarousel
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        setZoomLevel={setZoomLevel}
        zoomLevel={zoomLevel}
        imgEvent={imgEvent}
      />
    </Container>
  )
}
