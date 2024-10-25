import Link from "next/link";
import React from "react";

const ServiceCard = ({ title = "Service", description = "", path = "/" }) => {
  return (
    <div className="h-[200px] w-[288px] border rounded-[24px] flex justify-center items-center">
      <Link href={path}>
        <p className="text-2xl font-bold text-green-400">{title}</p>
        <p className="text-xl font-semibold text-gray-500">{description}</p>
      </Link>
    </div>
  );
};

export default ServiceCard;
