"use client";
import { copyToClipboard } from "@/utils/clipboardUtils";
import { Button } from "@nextui-org/react";
import { Clipboard } from "lucide-react";
import React from "react";
import confetti from "canvas-confetti";

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
  const handleCopy = async (event: React.MouseEvent<HTMLButtonElement>) => {
    try {
      await copyToClipboard(value);
      const rect = event.currentTarget.getBoundingClientRect();
      confetti({
        origin: {
          x: (rect.left + rect.width / 2) / window.innerWidth,
          y: (rect.top + rect.height / 2) / window.innerHeight,
        },
      });
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
          onPress={handleCopy}
          aria-label={`Copy ${title.toLowerCase()}`}
          className="w-[34px] group min-w-[34px] flex justify-center items-center h-[30px] border rounded-[12px] bg-[#fafafa] dark:bg-[#232323] absolute top-[10px] right-[10px]"
        >
          <Clipboard
            size={14}
            className="dark:text-white text-black group-hover:text-white group-hover:dark:text-black"
          />
        </Button>
      )}
    </div>
  );
};

export default ContactDetailsCard;
