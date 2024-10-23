import React from 'react'

const LINKEDIN_ICON = ({ className, width, height }: IconProps) => {
  return (
    <svg width={width?width:"36"} height={height?height:"33"} viewBox={`0 0 ${width?width:36} ${height?height:33}`} fill="none" xmlns="http://www.w3.org/2000/svg">
    <g clipPath="url(#clip0_482_444)">
    <path d="M7.94541 10.5835H0.928223V32.9999H7.94541V10.5835Z" className={className}/>
    <path d="M4.28906 0C1.70156 0 0 1.67035 0 3.88813C0 6.0638 1.64531 7.77626 4.19063 7.77626H4.24687C6.89062 7.77626 8.53594 6.04977 8.52188 3.88813C8.46563 1.67035 6.87656 0 4.28906 0Z" className={className}/>
    <path d="M27.1124 10.373C23.0905 10.373 20.5733 12.5628 20.1093 14.1068V10.5836H12.2202C12.3187 12.4505 12.2202 33 12.2202 33H20.1093V20.8864C20.1093 20.1987 20.0812 19.5249 20.278 19.0477C20.8124 17.7001 21.9796 16.2965 24.0749 16.2965C26.8171 16.2965 28.0546 18.3739 28.0546 21.4058V33H36.014V20.5355C36.014 13.6015 32.1046 10.373 27.1124 10.373Z" className={className}/>
    </g>
    <defs>
    <clipPath id="clip0_482_444">
    <rect width={width?width:"36"} height={height?height:"33"} className={className}/>
    </clipPath>
    </defs>
    </svg>
  )
}

export default LINKEDIN_ICON
