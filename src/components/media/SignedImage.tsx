import React from "react";
import { useSignedStorageUrl } from "@/hooks/useSignedStorageUrl";

type Props = Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src?: string | null;
};

/** <img> replacement that transparently signs private-bucket URLs. */
export const SignedImage = React.forwardRef<HTMLImageElement, Props>(
  ({ src, ...rest }, ref) => {
    const signed = useSignedStorageUrl(src);
    return <img ref={ref} {...rest} src={signed ?? undefined} />;
  },
);
SignedImage.displayName = "SignedImage";

type LinkProps = Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  "href" | "onClick"
> & {
  href?: string | null;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
  children?: React.ReactNode;
};

/** <a> replacement that signs the href on click for private-bucket URLs. */
export const SignedLink = React.forwardRef<HTMLAnchorElement, LinkProps>(
  ({ href, onClick, children, ...rest }, ref) => {
    const signed = useSignedStorageUrl(href);
    return (
      <a ref={ref} {...rest} href={signed ?? undefined} onClick={onClick}>
        {children}
      </a>
    );
  },
);
SignedLink.displayName = "SignedLink";
