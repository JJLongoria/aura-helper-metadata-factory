import { CoreUtils, FileChecker, FileReader, GitDiff, MetadataDetail, MetadataItem, MetadataObject, MetadataSuffixByType, MetadataType, MetadataTypes, NotIncludedMetadata, PathUtils, PicklistValue, ProjectConfig, RecordType, SObject, SObjectField, TypesFromGit, WrongDatatypeException, WrongFormatException } from '@aurahelper/core';
import { XML } from '@aurahelper/languages';
import { MetadataFactory } from '../index';
import { readFileSync } from 'fs';

const XMLParser = XML.XMLParser;

describe('Testing ./src/types/factory.js', () => {
    test('Testing createMetadataDetails()', () => {
        const objects = [
            {
                directoryName: 'objects',
                inFolder: true,
                metaFile: true,
                suffix: 'object',
                xmlName: 'CustomObject',
                childXmlNames: [
                    'CustomField',
                    'RecordType',
                    'ValidationRule',
                    'Index',
                    'CompactLayout',
                    'BussinesProcess'
                ]
            },
            {
                directoryName: 'layouts',
                inFolder: true,
                metaFile: true,
                suffix: 'layout',
                xmlName: 'Layout',
            }
        ];
        let result = MetadataFactory.createMetadataDetails(objects);
        expect(result.length).toEqual(8);
        result = MetadataFactory.createMetadataDetails('./src/test/assets/metadataTypes.json');
        expect(result.length).toBeGreaterThan(0);
        result = MetadataFactory.createMetadataDetails({});
        expect(result.length).toEqual(0);
        try {
            MetadataFactory.createMetadataDetails('./src/test/assets/nonJsonFile.txt');
        } catch (error) {
            const err = error as Error;
            expect(err.message).toMatch('The provided string response is not a JSON or file path');
        }
    });
    test('Testing createSObjectsFromFileSystem()', () => {
        const result = MetadataFactory.createSObjectsFromFileSystem('./src/test/assets/SFDXProject/force-app/main/default/objects');
        expect(Object.keys(result).length).toEqual(203);
        expect(result['account']).toBeDefined();
    });
    test('Testing createMetadataTypeFromRecords()', () => {
        const records = [
            {
                FolderName: 'FolderName1',
                NamespacePrefix: '',
                DeveloperName: 'devName1'
            },
            {
                FolderName: 'Private Reports',
                NamespacePrefix: '',
                DeveloperName: 'devName3'
            },
            {
                FolderName: 'FolderName2',
                NamespacePrefix: '',
                DeveloperName: 'devName2'
            },
            {
                FolderName: 'FolderName4',
                NamespacePrefix: '',
                FolderId: 'folder3',
                DeveloperName: 'devName4'
            }
        ];
        const foldersByType = {
            Report: [
                {
                    Name: 'FolderName1',
                    Id: 'folder1',
                    DeveloperName: 'folder1',
                },
                {
                    Name: 'FolderName2',
                    Id: 'folder2',
                    DeveloperName: 'folder2',
                }
            ],
            EmailTemplate: [
                {
                    Name: 'FolderName3',
                    FolderId: 'folder3',
                    Id: 'folder3',
                    DeveloperName: 'folder3',
                }
            ]
        };
        let metadataType = MetadataFactory.createMetadataTypeFromRecords('Report', records, foldersByType, '', true);
        expect(metadataType.name).toEqual('Report');
        expect(metadataType.getChild('folder1')!.name).toEqual('folder1');
        expect(metadataType.getChild('folder2')!.name).toEqual('folder2');
        expect(metadataType.getChild('folder1')!.getChild('devName1')!.name).toEqual('devName1');
        expect(metadataType.getChild('folder2')!.getChild('devName2')!.name).toEqual('devName2');
        metadataType = MetadataFactory.createMetadataTypeFromRecords('EmailTemplate', records, foldersByType, '', true);
        expect(metadataType.name).toEqual('EmailTemplate');
        expect(metadataType.getChild('folder3')!.name).toEqual('folder3');
        expect(metadataType.getChild('folder3')!.getChild('devName4')!.name).toEqual('devName4');
    });
    test('Testing createMetedataTypeFromResponse()', () => {
        const response1 = {
            status: 0,
            result: [
                {
                    fullName: 'Account',
                },
                {
                    fullName: 'Case',
                }
            ]
        };
        let result = MetadataFactory.createMetedataTypeFromResponse('CustomObject', response1, '', false);
        expect(result!.name)!.toEqual('CustomObject');
        expect(result!.getChild('Account')!.name).toEqual('Account');
        expect(result!.getChild('Case')!.name).toEqual('Case');
        const response2 = {
            status: 0,
            result: [
                {
                    fullName: 'Account.Name',
                },
                {
                    fullName: 'Account.FirstName',
                }
            ]
        };
        result = MetadataFactory.createMetedataTypeFromResponse('CustomField', response2, '', false);
        expect(result!.name).toEqual('CustomField');
        expect(result!.getChild('Account')!.name).toEqual('Account');
        expect(result!.getChild('Account')!.getChild('Name')!.name).toEqual('Name');
        expect(result!.getChild('Account')!.getChild('FirstName')!.name).toEqual('FirstName');
        const response3 = {
            status: 0,
            result: [
                {
                    fullName: 'Account',
                },
                {
                    fullName: 'Case',
                }
            ]
        };
        result = MetadataFactory.createMetedataTypeFromResponse('CustomObject', response3, '', false);
        expect(result!.name).toEqual('CustomObject');
        expect(result!.getChild('Account')!.name).toEqual('Account');
        expect(result!.getChild('Case')!.name).toEqual('Case');
        const response4 = {
            status: 0,
            result: [
                {
                    fullName: 'Account.Name',
                },
                {
                    fullName: 'Account.FirstName',
                }
            ]
        };
        result = MetadataFactory.createMetedataTypeFromResponse('CustomField', response4, '', false);
        expect(result!.name).toEqual('CustomField');
        expect(result!.getChild('Account')!.name).toEqual('Account');
        expect(result!.getChild('Account')!.getChild('Name')!.name).toEqual('Name');
        expect(result!.getChild('Account')!.getChild('FirstName')!.name).toEqual('FirstName');
        const response5 = {
            status: 0,
            result: [
                {
                    fullName: 'Account-Account_Layout1',
                },
                {
                    fullName: 'Account-Account_Layout2',
                }
            ]
        };
        result = MetadataFactory.createMetedataTypeFromResponse('Layout', response5, '', false);
        expect(result!.name).toEqual('Layout');
        expect(result!.getChild('Account')!.name).toEqual('Account');
        expect(result!.getChild('Account')!.getChild('Account_Layout1')!.name).toEqual('Account_Layout1');
        expect(result!.getChild('Account')!.getChild('Account_Layout2')!.name).toEqual('Account_Layout2');

        result = MetadataFactory.createMetedataTypeFromResponse('Layout', JSON.stringify(response5, null, 2), '', false);
        expect(result!.name).toEqual('Layout');
        expect(result!.getChild('Account')!.name).toEqual('Account');
        expect(result!.getChild('Account')!.getChild('Account_Layout1')!.name).toEqual('Account_Layout1');
        expect(result!.getChild('Account')!.getChild('Account_Layout2')!.name).toEqual('Account_Layout2');

        const response6 = undefined;
        result = MetadataFactory.createMetedataTypeFromResponse('Layout', response6, '', false);
        expect(result).toBeUndefined();

        const response7 = {
            status: 0,
            result: undefined
        };
        result = MetadataFactory.createMetedataTypeFromResponse('Layout', response7, '', false);
        expect(result).toBeUndefined();
        try {
            result = MetadataFactory.createMetedataTypeFromResponse('Layout', 'This is not a JSON\nmust fail', '', false);
        } catch (error) {
            const err = error as Error;
            expect(err.message).toMatch('The provided string response is not a JSON');
        }
        try {
            result = MetadataFactory.createMetedataTypeFromResponse('Layout', [], '', false);
        } catch (error) {
            const err = error as Error;
            expect(err.message).toMatch('The provided response is not a JSON string or JSON Object');
        }
    });
    test('Testing createNotIncludedMetadataType()', () => {
        let result = MetadataFactory.createNotIncludedMetadataType('StandardValueSet');
        expect(result!.name).toEqual('StandardValueSet');
        result = MetadataFactory.createNotIncludedMetadataType('StandardValueSets');
        expect(result).toBeUndefined();
    });
    test('Testing createSObjectFromJSONSchema()', () => {
        const data =readFileSync('./src/test/assets/describeSObject.json', 'utf8');
        const Sobject = MetadataFactory.createSObjectFromJSONSchema(data);
        expect(Sobject!.name).toEqual('acn__Account__c');
        expect(Sobject!.getField('acn__Location__c')!.name).toEqual('acn__Location__c');
    });
    test('Testing createMetadataTypesFromFileSystem()', () => {
        const metadata = JSON.parse(readFileSync('./src/test/assets/metadataTypes.json', 'utf8'));
        const metadataDetails = MetadataFactory.createMetadataDetails(metadata.result.metadataObjects);
        const folderMetadataMap = MetadataFactory.createFolderMetadataMap(metadataDetails);
        let result = MetadataFactory.createMetadataTypesFromFileSystem(folderMetadataMap, './src/test/assets/SFDXProject');
        result = MetadataFactory.deserializeMetadataTypes(result, true);
        expect(result['CustomObject'].name).toEqual('CustomObject');
        result = MetadataFactory.createMetadataTypesFromFileSystem(metadataDetails, './src/test/assets/SFDXProject');
        expect(result['CustomObject'].name).toEqual('CustomObject');
        result = MetadataFactory.createMetadataTypesFromFileSystem(folderMetadataMap, './src/test/assets/MDAPIProject');
        expect(result['CustomObject'].name).toEqual('CustomObject');
        result = MetadataFactory.createMetadataTypesFromFileSystem(folderMetadataMap, './src/test/assets');
        expect(result).toEqual({});
    });
    test('Testing createMetadataTypesFromPackageXML()', () => {
        const xmlContent = readFileSync('./src/test/assets/SFDXProject/manifest/package.xml', 'utf8');
        let metadataTypes = MetadataFactory.createMetadataTypesFromPackageXML(xmlContent, true);
        expect(metadataTypes['CustomObject'].name).toEqual('CustomObject');
        const xmlRoot = XMLParser.parseXML(xmlContent);
        metadataTypes = MetadataFactory.createMetadataTypesFromPackageXML(xmlRoot);
        expect(metadataTypes['CustomObject'].name).toEqual('CustomObject');
        metadataTypes = MetadataFactory.createMetadataTypesFromPackageXML(undefined);
        expect(metadataTypes).toEqual({});
        metadataTypes = MetadataFactory.createMetadataTypesFromPackageXML('./src/test/assets/SFDXProject/manifest/package.xml');
        try {
            MetadataFactory.createMetadataTypesFromPackageXML('./src/test/assets/SFDXProject/manifest');
        } catch (error) {
            expect(error.message).toMatch('Not a valid package.xml content. Check the file format');
        }
        expect(metadataTypes['CustomObject'].name).toEqual('CustomObject');
        try {
            MetadataFactory.createMetadataTypesFromPackageXML([]);
        } catch (error) {
            expect(error.message).toMatch('Wrong data parameter. Expect a package file path');
        }
        try {
            MetadataFactory.createMetadataTypesFromPackageXML({ root: { value: '' } });
        } catch (error) {
            expect(error.message).toMatch('Not a valid package.xml content. Check the file format');
        }
    });
    test('Testing createMetadataTypesFromGitDiffs()', () => {
        const metadata = JSON.parse(readFileSync('./src/test/assets/metadataTypes.json', 'utf8'));
        const metadataDetails = MetadataFactory.createMetadataDetails(metadata.result.metadataObjects);
        const folderMetadataMap = MetadataFactory.createFolderMetadataMap(metadataDetails);
        let metadataTypes = MetadataFactory.createMetadataTypesFromGitDiffs('./src/test/assets/SFDXProject', JSON.parse(FileReader.readFileSync('./src/test/assets/diffOut.json')), folderMetadataMap);
        expect(metadataTypes!.toDeploy!['ApexComponent']).toBeDefined();
        metadataTypes = MetadataFactory.createMetadataTypesFromGitDiffs('./src/test/assets/SFDXProject', JSON.parse(FileReader.readFileSync('./src/test/assets/diffOut.json')), metadataDetails, true);
        expect(metadataTypes!.toDeploy!['ApexComponent']).toBeDefined();
    });
});