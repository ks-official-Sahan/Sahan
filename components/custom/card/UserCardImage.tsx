import { Site } from "@/config/site";
import Image from "next/image";
import React from "react";

const UserCardImage = ({ width = 406, height = 362 }) => {
  return (
    <>
      <Image
        src={"/me/sahan.svg"}
        // fill
        width={width - 20}
        height={height - 40}
        alt={Site.author}
        quality={70}
        priority
      />
    </>
  );
};

export default UserCardImage;
