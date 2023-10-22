import { FileReader } from "@aurahelper/core";
import { readFileSync } from "fs";
import { MetadataFactory } from ".";

const metadata = JSON.parse(FileReader.readFileSync('./src/test/assets/metadataTypes.json'));
const metadataDetails = MetadataFactory.createMetadataDetails(metadata.result.metadataObjects);
const folderMetadataMap = MetadataFactory.createFolderMetadataMap(metadataDetails);
let metadataTypes = MetadataFactory.createMetadataTypesFromGitDiffs('./src/test/assets/SFDXProject', JSON.parse(FileReader.readFileSync('./src/test/assets/diffs.json')), folderMetadataMap);
metadataTypes = MetadataFactory.createMetadataTypesFromGitDiffs('./src/test/assets/SFDXProject', JSON.parse(FileReader.readFileSync('./src/test/assets/diffOut.json')), metadataDetails, true);
