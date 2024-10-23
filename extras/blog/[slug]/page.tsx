"use client"
import { useParams, useSearchParams } from 'next/navigation'
import React from 'react'

const BlogDetails = () => {

    const params = useParams();
    const searchParams = useSearchParams();
    
    console.log(params);
    console.log(searchParams.get("b"));


  return (
    <div className='min-h-screen w-full flex justify-center items-center'>
      {params.slug}
      {searchParams.get("b")}
    </div>
  )
}

export default BlogDetails