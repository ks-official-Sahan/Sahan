import TitleBlock from "@/components/common/TitleBlock";
import WrapperBody from "@/components/wrappers/WrapperBody";
import { Site } from "@/config/site";
import { HomeContent } from "@/contents/home";
import { Github, Mail, MessageCircle } from "lucide-react";
import Link from "next/link";
import React from "react";

const actions = [
  { label: "Email me", href: `mailto:${Site.email}`, icon: Mail },
  { label: "Contact page", href: "/contact", icon: MessageCircle },
  { label: "GitHub", href: Site.gitHubUrl, icon: Github, external: true },
];

const WelcomeSection = () => {
  const { welcome } = HomeContent;

  return (
    <section id="welcome" className="flex flex-col items-center pt-[100px]">
      <WrapperBody>
        <div className="flex flex-col items-center gap-10 rounded-[12px] border border-bBORDERFADE bg-bCARD px-8 py-14 text-center">
          <TitleBlock
            isBadge
            isSubtitle
            titleAs="h2"
            className="flex flex-col items-center"
            icon={<span aria-hidden="true">{welcome.icon}</span>}
            title={welcome.title}
            subtitle={welcome.subtitle}
            label={welcome.label}
            titleClass="text-[2rem] font-bold uppercase pt-[12px]"
            subTitleClass="max-w-[520px] pt-2 text-[15px] opacity-65"
          />

          <div className="flex flex-wrap items-center justify-center gap-4">
            {actions.map(({ label, href, icon: Icon, external }) => (
              <Link
                key={label}
                href={href}
                target={external ? "_blank" : undefined}
                rel={external ? "noopener noreferrer" : undefined}
                className="flex h-[46px] items-center justify-center gap-[6px] rounded-[12px] border border-bBORDERFADE bg-bFRAME px-6 text-[14px] font-medium opacity-90 transition-opacity hover:opacity-100"
              >
                <Icon size={14} className="text-bICON" aria-hidden="true" />
                {label}
              </Link>
            ))}
          </div>
        </div>
      </WrapperBody>
    </section>
  );
};

export default WelcomeSection;
