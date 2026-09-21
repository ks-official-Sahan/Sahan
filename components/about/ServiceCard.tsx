import TitleBlock from "@/components/common/TitleBlock";
import ChipMarquee from "@/components/common/ChipMarquee";
import { cn } from "@/lib/utils";
import type { Service, ServiceDoneItem } from "@/types/service";
import Link from "next/link";
import React from "react";

const DoneChip = ({ item }: { item: ServiceDoneItem }) => (
  <div className="flex items-center gap-3 rounded-[12px] bg-bPLACEHOLDER p-[6px] pl-3">
    <span className="text-[12px] font-medium">{item.name}</span>
    <span className="rounded-[8px] bg-bLINKHOLDER px-[10px] py-1 text-[12px] font-medium opacity-70">
      {item.count}
    </span>
  </div>
);

const ServiceCard = ({
  service,
  className,
}: {
  service: Service;
  className?: string;
}) => {
  const { id, icon: Icon, name, description, done } = service;

  return (
    <div
      className={cn(
        "flex h-full w-full flex-col gap-4 rounded-[12px] border border-bBORDERFADE bg-bCARD p-6",
        className
      )}
    >
      <div>
        <TitleBlock
          title={name}
          titleAs="h3"
          label={id}
          icon={<Icon size={16} className="text-bICON" aria-hidden="true" />}
        />
        <p className="pt-4 text-[14px] font-medium opacity-80">{description}</p>
      </div>

      {done && (
        <div className="mt-auto flex flex-col gap-3 pt-2">
          <div className="flex items-center justify-between">
            <div className="text-[12px] font-semibold">{done.title}</div>
            {done.href && (
              <Link
                href={done.href}
                className="text-[12px] font-semibold italic underline opacity-70 hover:opacity-100"
              >
                View Works
              </Link>
            )}
          </div>

          <div className="rounded-[20px] border border-bBORDERFADE bg-bBENTO_CHIP p-2">
            <ChipMarquee label={done.title} minItems={4} duration={24}>
              {done.list.map((item) => (
                <DoneChip key={item.name} item={item} />
              ))}
            </ChipMarquee>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceCard;
