"use client";
import { copyToClipboard } from "@/utils/clipboardUtils";
import { Button } from "@nextui-org/react";
import { Clipboard } from "lucide-react";
import React, { useEffect, useState } from "react";
import { ConfettiButton } from "../magicui/confetti";

interface ContactDetailsCardProps {
  title: string;
  value: string;
  displayValue?: string;
  icon: React.ReactNode;
  copy?: boolean;
}

const ContactDetailsCard = ({
  title,
  value,
  displayValue,
  icon,
  copy = false,
}: ContactDetailsCardProps) => {
  const [message, setMessage] = useState("Hello I am Sahan,");

  useEffect(() => {
    setMessage(value);
  }, [value]);

  const handleCopy = async () => {
    try {
      await copyToClipboard(message);
    } catch (err) {
      alert("Failed to copy text to clipboard." + err);
    }
  };

  return (
    <div className="w-full border p-[12px] rounded-[12px] bg-[#fff] dark:bg-[#1A1A1A] min-h-[74px] flex gap-[15px] items-center relative">
      <div className="w-[50px] h-[50px] border bg-[#fafafa] dark:bg-[#232323] rounded-[12px] flex items-center justify-center text-[#19cf31] dark:text-[#91FF00]">
        {icon}
      </div>

      <div className="flex flex-col gap-1">
        <div className="text-[14px] font-semibold text-secondaryT">{title}</div>
        <div className="text-[12px] font-medium opacity-80">
          {displayValue ? displayValue : value}
        </div>
      </div>

      {copy && (
        <Button
          onClick={handleCopy}
          className="w-[34px] group min-w-[34px] flex justify-center items-center h-[30px] border rounded-[12px] bg-[#fafafa] dark:bg-[#232323] absolute top-[10px] right-[10px]"
        >
          <ConfettiButton className="bg-transparent dark:text-white text-black group-hover:text-white group-hover:dark:text-black">
            <Clipboard size={14} />
          </ConfettiButton>
        </Button>
      )}
    </div>
  );
};

export default ContactDetailsCard;
