import Link from "next/link";
import React from "react";

const ServiceCard = ({
  title = "Service",
  description = "",
  path = "/",
  className = "flex ",
  width = 288,
  height = 200,
}) => {
  return (
    <div
      className={`${className} border rounded-[24px] justify-center items-center p-4 max-h-full max-w-full self-stretch`}
      style={{
        width: `${width}px`,
        height: `${height !== 200 ? height + "px" : "auto"}`,
        minHeight: "200px",
      }}
    >
      <Link
        href={path}
        className={`p-2 w-full h-full flex flex-col justify-center items-center`}
      >
        <p className="text-2xl font-bold text-green-400 text-center pb-1">
          {title}
        </p>
        <p className="text-xl font-semibold text-gray-500 text-center overflow-wrap break-words">
          {description}
        </p>
      </Link>
    </div>
  );
};

export default ServiceCard;
