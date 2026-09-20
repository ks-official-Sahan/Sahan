import { Site } from "@/config/site";
import Image from "next/image";
import React from "react";

const UserCardImage = ({ width = 406, height = 362 }) => {
  return (
    <>
      <Image
        src={"/me/sahan.svg"}
        width={width - 20}
        height={height - 40}
        alt={Site.author}
        quality={70}
        priority
        style={{ width: "auto", height: "auto" }}
        className="max-w-full max-h-full object-contain"
      />
    </>
  );
};

export default UserCardImage;
