/**
 * Liquid Glass 표면.
 * - 모든 브라우저: 블러 + 채도 + 스펙큘러 테두리 (index.css 의 `glass` 유틸리티)
 * - Chromium: `refract` 를 주면 가장자리 렌즈 굴절이 추가됩니다 (<RefractionFilter /> 필요)
 */
export function Glass({ as: Tag = 'div', strong = false, refract = false, className = '', children, ...rest }) {
  const cls = ['glass', strong && 'glass-strong', refract && 'glass-refract', className].filter(Boolean).join(' ')
  return (
    <Tag className={cls} {...rest}>
      {children}
    </Tag>
  )
}

// 가장자리일수록 바깥쪽으로 밀어내는 변위 맵. R=가로, G=세로, 중앙(128)=변위 없음.
const MAP = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" preserveAspectRatio="none">
<defs>
<linearGradient id="r" x1="0" x2="1"><stop offset="0" stop-color="#f00"/><stop offset="1" stop-color="#000"/></linearGradient>
<linearGradient id="g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#0f0"/><stop offset="1" stop-color="#000"/></linearGradient>
<filter id="b"><feGaussianBlur stdDeviation="9"/></filter>
</defs>
<rect width="200" height="200" fill="#000"/>
<rect width="200" height="200" fill="url(#r)"/>
<rect width="200" height="200" fill="url(#g)" style="mix-blend-mode:screen"/>
<rect x="22" y="22" width="156" height="156" rx="40" fill="#808080" filter="url(#b)"/>
</svg>`)}`

export function RefractionFilter() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <filter id="lg-refract" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feImage href={MAP} x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="map" />
        <feDisplacementMap in="SourceGraphic" in2="map" scale="-36" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  )
}
