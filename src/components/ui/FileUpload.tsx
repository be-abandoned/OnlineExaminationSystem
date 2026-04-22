import { useRef, useState } from "react";
import { Image, Upload, X } from "lucide-react";
import Button from "./Button";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  value?: string;
  onChange: (url: string) => void;
  onRemove?: () => void;
  accept?: string;
  className?: string;
  placeholder?: string;
}

export default function FileUpload({
  value,
  onChange,
  onRemove,
  accept = "image/*",
  className,
  placeholder = "上传图片",
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      // TODO: 这里应该调用真实的后端上传接口
      // 暂时使用 FileReader 模拟上传并返回 base64 URL
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        onChange(result);
        setIsUploading(false);
      };
      reader.onerror = () => {
        console.error("文件读取失败");
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("上传失败", error);
      setIsUploading(false);
    } finally {
      // 重置 input，允许重复选择同一文件
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleFileChange}
      />
      
      {value ? (
        <div className="relative group w-fit max-w-full">
          <img
            src={value}
            alt="Uploaded content"
            className="max-h-[300px] w-auto max-w-full rounded-md border border-zinc-200 object-contain bg-zinc-50"
          />
          <button
            type="button"
            onClick={onRemove}
            className="absolute -top-2 -right-2 rounded-full bg-white p-1 text-zinc-500 shadow-sm border border-zinc-200 hover:text-red-600 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
            title="移除图片"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <Button
          type="button"
          variant="secondary"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
          className="w-fit"
        >
          {isUploading ? (
            <span className="flex items-center">
              <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" />
              上传中...
            </span>
          ) : (
            <>
              <Image className="mr-2 h-4 w-4" />
              {placeholder}
            </>
          )}
        </Button>
      )}
    </div>
  );
}
