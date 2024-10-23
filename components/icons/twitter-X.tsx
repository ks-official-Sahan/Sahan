import React from 'react'

const X_ICON = ({ className, width, height }: IconProps) => {
  return (
    <svg width={width?width:"36"} height={height?height:"33"} viewBox={`0 0 ${width?width:36} ${height?height:33}`} fill="none" xmlns="http://www.w3.org/2000/svg">
      <g clip-path="url(#clip0_482_437)">
        <path d="M0.0878895 0L13.9863 18.2054L0 33.0007H3.14777L15.3932 20.0449L25.29 33.0014H35.9993L21.318 13.7754L34.3367 0H31.189L19.9118 11.93L10.7993 0H0.0878895ZM4.71723 2.27142H9.63831L31.3677 30.7293H26.4481L4.71723 2.27142Z"  className={className} />
      </g>
      <defs>
        <clipPath id="clip0_482_437">
          <rect width={width?width:"36"} height={height?height:"33"} className={className} />
        </clipPath>
      </defs>
    </svg>
  )
}

export default X_ICON
