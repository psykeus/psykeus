"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileUp, Archive, FolderOpen } from "lucide-react";
import { UploadForm } from "./UploadForm";
import { ZipUploadForm } from "./ZipUploadForm";
import { ProjectUploadForm } from "./ProjectUploadForm";

export function UploadTabs() {
  const [activeTab, setActiveTab] = useState("single");

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-3 mb-6">
        <TabsTrigger value="single" className="flex items-center gap-2">
          <FileUp className="h-4 w-4" />
          Single File
        </TabsTrigger>
        <TabsTrigger value="project" className="flex items-center gap-2">
          <FolderOpen className="h-4 w-4" />
          Multi-File Project
        </TabsTrigger>
        <TabsTrigger value="zip" className="flex items-center gap-2">
          <Archive className="h-4 w-4" />
          ZIP Upload
        </TabsTrigger>
      </TabsList>

      <TabsContent value="single" className="mt-0">
        <UploadForm />
      </TabsContent>

      <TabsContent value="project" className="mt-0">
        <ProjectUploadForm />
      </TabsContent>

      <TabsContent value="zip" className="mt-0">
        <ZipUploadForm />
      </TabsContent>
    </Tabs>
  );
}
